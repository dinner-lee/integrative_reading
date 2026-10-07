import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, authorizeGroup, handle } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const run = await db.analysisRun.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!run) throw new ApiError(404, "분석 기록을 찾을 수 없어요.");
  return run;
}

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const run = await load(id);
  await authorizeGroup(run.groupId, "read");
  return NextResponse.json({ run });
});

const Patch = z.object({ note: z.string().max(4000) });

/** 해석 메모 저장 */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const run = await load(id);
  const { group, actor } = await authorizeGroup(run.groupId, "write");
  const { note } = Patch.parse(await req.json());
  await db.analysisRun.update({ where: { id }, data: { note } });
  await logEvent({
    classroomId: group.classroomId,
    groupId: group.id,
    actorType: actor.type,
    actorId: actor.id,
    actorName: "name" in actor ? actor.name : null,
    stage: "analyze",
    type: "analysis.note",
    payload: { runId: id, note },
  });
  return NextResponse.json({ ok: true });
});
