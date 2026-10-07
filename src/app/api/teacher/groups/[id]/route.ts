import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handle, requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

async function ownGroup(id: string) {
  const t = await requireTeacher();
  const g = await db.group.findFirst({ where: { id, classroom: { teacherId: t.id } } });
  if (!g) throw new ApiError(404, "모둠을 찾을 수 없어요.");
  return g;
}

const Patch = z.object({ name: z.string().trim().min(1).max(30) });

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await ownGroup(id);
  const { name } = Patch.parse(await req.json());
  const group = await db.group.update({ where: { id }, data: { name } });
  return NextResponse.json({ group });
});

/** 모둠 삭제: 자료·분석 기록도 함께 지워지므로 학생이 없는 빈 모둠만 허용 */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await ownGroup(id);
  const [students, materials] = await Promise.all([
    db.student.count({ where: { groupId: id } }),
    db.material.count({ where: { groupId: id } }),
  ]);
  if (students || materials) throw new ApiError(409, "학생이나 자료가 있는 모둠은 지울 수 없어요. 먼저 학생을 옮겨 주세요.");
  await db.group.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
