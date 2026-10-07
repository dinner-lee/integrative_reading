import { NextResponse } from "next/server";
import { handle, requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { groupRoomId } from "@/lib/rooms";

/** 학생 화면이 주기적으로 불러오는 내 정보 + 학급 설정(열린 단계 등) */
export const GET = handle(async () => {
  const st = await requireStudent();
  const c = st.classroom;
  const groups = await db.group.findMany({
    where: { classroomId: c.id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, _count: { select: { students: true, materials: { where: { deletedAt: null } } } } },
  });
  const members = st.groupId
    ? await db.student.findMany({
        where: { groupId: st.groupId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  return NextResponse.json({
    student: { id: st.id, name: st.name },
    group: st.group ? { id: st.group.id, name: st.group.name, roomId: groupRoomId(c.id, st.group.id) } : null,
    members,
    classroom: {
      id: c.id,
      name: c.name,
      openStages: c.openStages,
      writingMode: c.writingMode,
      allowPeerView: c.allowPeerView,
      selfSelectGroup: c.selfSelectGroup,
      enabledMethods: c.enabledMethods,
    },
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      roomId: groupRoomId(c.id, g.id),
      students: g._count.students,
      materials: g._count.materials,
    })),
  });
});
