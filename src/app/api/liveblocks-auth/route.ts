import { NextResponse } from "next/server";
import { getStudentContext, getTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { liveblocks } from "@/lib/liveblocks-server";
import { colorFor, parseRoomId } from "@/lib/rooms";

/**
 * 방 하나씩 권한을 준다.
 * - 학생: 자기 모둠 방은 쓰기, 같은 학급 다른 모둠 방은(허용 시) 읽기만
 * - 교사: 담당 학급의 모든 모둠 방 쓰기(댓글로 안내 가능)
 */
export async function POST(req: Request) {
  const { room } = (await req.json().catch(() => ({}))) as { room?: string };
  const parsed = room ? parseRoomId(room) : null;
  if (!room || !parsed) return new NextResponse("room required", { status: 400 });

  const group = await db.group.findUnique({
    where: { id: parsed.groupId },
    include: { classroom: true },
  });
  if (!group || group.classroomId !== parsed.classroomId) return new NextResponse("not found", { status: 404 });

  const st = await getStudentContext();
  if (st && st.classroomId === group.classroomId) {
    const session = liveblocks().prepareSession(`s:${st.id}`, {
      userInfo: { name: st.name, color: colorFor(st.id), role: "student", groupName: st.group?.name },
    });
    if (st.groupId === group.id) {
      session.allow(room, session.FULL_ACCESS);
    } else if (group.classroom.allowPeerView) {
      session.allow(room, session.READ_ACCESS);
    } else {
      return new NextResponse("forbidden", { status: 403 });
    }
    const { status, body } = await session.authorize();
    return new NextResponse(body, { status });
  }

  const t = await getTeacher();
  if (t && group.classroom.teacherId === t.id) {
    const session = liveblocks().prepareSession(`t:${t.id}`, {
      userInfo: { name: `${t.name} 선생님`, color: "#111827", role: "teacher" },
    });
    session.allow(room, session.FULL_ACCESS);
    const { status, body } = await session.authorize();
    return new NextResponse(body, { status });
  }

  return new NextResponse("unauthorized", { status: 401 });
}
