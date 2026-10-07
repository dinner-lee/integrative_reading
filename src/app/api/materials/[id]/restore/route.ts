import { NextResponse } from "next/server";
import { ApiError, authorizeGroup, handle } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

/** 지운 자료 되돌리기 (삭제 뒤 토스트의 '되돌리기') */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const m = await db.material.findUnique({ where: { id } });
  if (!m) throw new ApiError(404, "자료를 찾을 수 없어요.");
  const { actor } = await authorizeGroup(m.groupId, "write");
  if (m.deletedAt) await db.material.update({ where: { id }, data: { deletedAt: null } });
  await logEvent({
    classroomId: m.classroomId,
    groupId: m.groupId,
    actorType: actor.type,
    actorId: actor.id,
    actorName: "name" in actor ? actor.name : null,
    stage: "collect",
    type: "material.restore",
    payload: { materialId: id, title: m.title },
  });
  return NextResponse.json({ ok: true });
});
