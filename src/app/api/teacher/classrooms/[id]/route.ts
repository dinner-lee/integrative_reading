import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireOwnClassroom } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { STAGE_KEYS } from "@/lib/stages";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { classroom } = await requireOwnClassroom(id);
  const [groups, students] = await Promise.all([
    db.group.findMany({ where: { classroomId: id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.student.findMany({
      where: { classroomId: id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, groupId: true, createdAt: true, lastSeenAt: true },
    }),
  ]);
  return NextResponse.json({ classroom, groups, students });
});

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  // 예전 학급의 'generate'(분석에 합쳐짐)는 받아서 걸러낸다
  openStages: z
    .array(z.string())
    .transform((v) => v.filter((k) => (STAGE_KEYS as string[]).includes(k)))
    .optional(),
  writingMode: z.enum(["group", "individual", "both"]).optional(),
  allowPeerView: z.boolean().optional(),
  selfSelectGroup: z.boolean().optional(),
  enabledMethods: z.array(z.enum(["tfidf_kmeans", "lda", "bertopic"])).optional(),
  archived: z.boolean().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { teacher } = await requireOwnClassroom(id);
  const data = Patch.parse(await req.json());
  const classroom = await db.classroom.update({ where: { id }, data });
  await logEvent({
    classroomId: id,
    actorType: "teacher",
    actorId: teacher.id,
    actorName: teacher.name,
    type: "teacher.classroom_update",
    payload: data,
  });
  return NextResponse.json({ classroom });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireOwnClassroom(id);
  await db.classroom.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
