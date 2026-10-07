import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeGroup, ApiError, handle, requireGroupedStudent } from "@/lib/auth";
import { analysisPost } from "@/lib/analysis";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";

const Body = z.object({
  materialId: z.string(),
  preprocess: z.object({
    pos: z.string(),
    stopwords: z.array(z.string().max(30)).max(500),
    minLength: z.number().int().min(1).max(5),
  }),
});

/** 자료 하나의 전처리 결과 미리보기(원문 → 형태소 → 남은 낱말) */
export const POST = handle(async (req: Request) => {
  const st = await requireGroupedStudent();
  const body = Body.parse(await req.json());
  const m = await db.material.findUnique({ where: { id: body.materialId } });
  if (!m || m.deletedAt) throw new ApiError(404, "자료를 찾을 수 없어요.");
  await authorizeGroup(m.groupId, "read");
  const result = await analysisPost("/preprocess", { text: m.content, preprocess: body.preprocess });
  await logEvent({
    classroomId: st.classroomId,
    groupId: st.groupId,
    actorType: "student",
    actorId: st.id,
    actorName: st.name,
    stage: "analyze",
    type: "analysis.preview",
    payload: { materialId: m.id, preprocess: body.preprocess, stats: result.stats },
  });
  return NextResponse.json(result);
});
