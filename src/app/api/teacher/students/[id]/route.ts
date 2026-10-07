import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handle, requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

async function ownStudent(id: string) {
  const t = await requireTeacher();
  const s = await db.student.findFirst({ where: { id, classroom: { teacherId: t.id } } });
  if (!s) throw new ApiError(404, "학생을 찾을 수 없어요.");
  return { t, s };
}

const Patch = z.object({
  groupId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(20).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { t, s } = await ownStudent(id);
  const data = Patch.parse(await req.json());
  if (data.groupId) {
    const g = await db.group.findFirst({ where: { id: data.groupId, classroomId: s.classroomId } });
    if (!g) throw new ApiError(400, "같은 학급의 모둠이 아니에요.");
  }
  if (data.name && data.name !== s.name) {
    const dup = await db.student.findUnique({ where: { classroomId_name: { classroomId: s.classroomId, name: data.name } } });
    if (dup) throw new ApiError(409, "같은 이름의 학생이 이미 있어요.");
  }
  const student = await db.student.update({ where: { id }, data });
  if (data.groupId !== undefined && data.groupId !== s.groupId) {
    await logEvent({
      classroomId: s.classroomId,
      groupId: data.groupId,
      actorType: "teacher",
      actorId: t.id,
      actorName: t.name,
      type: "teacher.assign_group",
      payload: { studentId: id, from: s.groupId, to: data.groupId },
    });
  }
  return NextResponse.json({ student });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await ownStudent(id);
  await db.student.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
