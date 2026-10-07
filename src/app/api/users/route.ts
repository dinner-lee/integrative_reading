import { NextResponse } from "next/server";
import { getStudentContext, getTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { colorFor } from "@/lib/rooms";

/** Liveblocks 댓글에 이름을 보여 주기 위한 resolveUsers 대응. 같은 학급 안에서만 조회한다. */
export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.getAll("userIds");
  const st = await getStudentContext();
  const teacher = st ? null : await getTeacher();
  if (!st && !teacher) return NextResponse.json([], { status: 401 });

  const studentIds = ids.filter((i) => i.startsWith("s:")).map((i) => i.slice(2));
  const teacherIds = ids.filter((i) => i.startsWith("t:")).map((i) => i.slice(2));

  const [students, teachers] = await Promise.all([
    db.student.findMany({
      where: {
        id: { in: studentIds },
        ...(st ? { classroomId: st.classroomId } : { classroom: { teacherId: teacher!.id } }),
      },
      select: { id: true, name: true },
    }),
    db.teacher.findMany({ where: { id: { in: teacherIds } }, select: { id: true, name: true } }),
  ]);
  const map = new Map<string, { name: string; color: string }>();
  students.forEach((s) => map.set(`s:${s.id}`, { name: s.name, color: colorFor(s.id) }));
  teachers.forEach((t) => map.set(`t:${t.id}`, { name: `${t.name} 선생님`, color: "#111827" }));
  return NextResponse.json(ids.map((id) => map.get(id) ?? { name: "알 수 없음", color: "#9ca3af" }));
}
