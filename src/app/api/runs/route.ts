import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, authorizeGroup, handle, requireGroupedStudent } from "@/lib/auth";
import { analysisPost } from "@/lib/analysis";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";

const Body = z.object({
  method: z.enum(["tfidf_kmeans", "lda", "bertopic"]),
  materialIds: z.array(z.string()).min(2, "자료를 2개 이상 골라 주세요.").max(200),
  preprocess: z.object({
    pos: z.enum(["nouns", "nouns_verbs", "content"]),
    stopwords: z.array(z.string().trim().max(30)).max(500),
    minLength: z.number().int().min(1).max(5),
  }),
  mining: z.object({
    k: z.number().int().min(1).max(12).nullable(),
    minDf: z.number().int().min(1).max(20),
    maxDf: z.number().gt(0).max(1),
    ngram: z.union([z.literal(1), z.literal(2)]),
  }),
});

type RunResult = {
  k: number;
  clusters: { id: number; size: number; terms: { term: string }[] }[];
  metrics: Record<string, number>;
  warnings: string[];
};

function summarize(r: RunResult) {
  return {
    k: r.k,
    clusters: r.clusters.map((c) => ({ size: c.size, terms: c.terms.slice(0, 3).map((t) => t.term) })),
    metrics: r.metrics,
    warnings: r.warnings.length,
  };
}

/** GET /api/runs?groupId=... 실행 기록 목록(결과 본문 제외) */
export const GET = handle(async (req: Request) => {
  let groupId = new URL(req.url).searchParams.get("groupId");
  if (!groupId) groupId = (await requireGroupedStudent()).groupId;
  await authorizeGroup(groupId, "read");
  const runs = await db.analysisRun.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      method: true,
      params: true,
      materialIds: true,
      note: true,
      createdAt: true,
      result: true,
      createdBy: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({
    runs: runs.map(({ result, ...r }) => ({ ...r, summary: summarize(result as unknown as RunResult) })),
  });
});

export const POST = handle(async (req: Request) => {
  const st = await requireGroupedStudent();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "조건을 확인해 주세요.");
  const body = parsed.data;
  if (!st.classroom.enabledMethods.includes(body.method)) {
    throw new ApiError(403, "선생님이 아직 열지 않은 분석 방법이에요.");
  }
  const all = await db.material.findMany({
    where: { groupId: st.groupId, deletedAt: null },
    select: { id: true, title: true, content: true },
    orderBy: { createdAt: "asc" },
  });
  const chosen = new Set(body.materialIds);
  const materials = all.filter((m) => chosen.has(m.id));
  if (materials.length < 2) throw new ApiError(400, "분석할 자료가 2개 이상 있어야 해요.");

  const started = Date.now();
  const result = (await analysisPost("/analyze", {
    method: body.method,
    docs: materials.map((m) => ({ id: m.id, title: m.title, text: m.content })),
    preprocess: body.preprocess,
    mining: body.mining,
  })) as RunResult;

  const run = await db.analysisRun.create({
    data: {
      groupId: st.groupId,
      createdById: st.id,
      method: body.method,
      params: { preprocess: body.preprocess, mining: body.mining },
      materialIds: materials.map((m) => m.id),
      result: result as object,
    },
    select: { id: true, createdAt: true },
  });
  await logEvent({
    classroomId: st.classroomId,
    groupId: st.groupId,
    actorType: "student",
    actorId: st.id,
    actorName: st.name,
    stage: "analyze",
    type: "analysis.run",
    payload: {
      runId: run.id,
      method: body.method,
      params: { preprocess: body.preprocess, mining: body.mining },
      materialCount: materials.length,
      excludedMaterialIds: all.filter((m) => !chosen.has(m.id)).map((m) => m.id),
      ms: Date.now() - started,
      summary: summarize(result),
    },
  });
  return NextResponse.json({ run: { id: run.id, createdAt: run.createdAt } });
});
