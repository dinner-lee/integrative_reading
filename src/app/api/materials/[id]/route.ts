import { NextResponse } from "next/server";
import { ApiError, authorizeGroup, handle } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { MaterialInput, materialSelect } from "../schema";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const m = await db.material.findUnique({ where: { id } });
  if (!m || m.deletedAt) throw new ApiError(404, "자료를 찾을 수 없어요.");
  return m;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const before = await load(id);
  const { actor } = await authorizeGroup(before.groupId, "write");
  const parsed = MaterialInput.safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.");
  const material = await db.material.update({ where: { id }, data: parsed.data, select: materialSelect });
  const changed = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter(
    (k) => (before as Record<string, unknown>)[k] !== parsed.data[k],
  );
  await logEvent({
    classroomId: before.classroomId,
    groupId: before.groupId,
    actorType: actor.type,
    actorId: actor.id,
    actorName: "name" in actor ? actor.name : null,
    stage: "collect",
    type: "material.update",
    payload: { materialId: id, changed, charsBefore: before.content.length, charsAfter: material.content.length },
  });
  return NextResponse.json({ material });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const before = await load(id);
  const { actor } = await authorizeGroup(before.groupId, "write");
  await db.material.update({ where: { id }, data: { deletedAt: new Date() } });
  await logEvent({
    classroomId: before.classroomId,
    groupId: before.groupId,
    actorType: actor.type,
    actorId: actor.id,
    actorName: "name" in actor ? actor.name : null,
    stage: "collect",
    type: "material.delete",
    payload: { materialId: id, title: before.title },
  });
  return NextResponse.json({ ok: true });
});
