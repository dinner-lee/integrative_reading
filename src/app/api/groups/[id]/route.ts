import { NextResponse } from "next/server";
import { authorizeGroup, handle } from "@/lib/auth";
import { db } from "@/lib/db";
import { groupRoomId } from "@/lib/rooms";

type Ctx = { params: Promise<{ id: string }> };

/** 다른 모둠 둘러보기·교사 보기용 모둠 기본 정보 */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { group } = await authorizeGroup(id, "read");
  const members = await db.student.findMany({
    where: { groupId: id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    group: { id: group.id, name: group.name, roomId: groupRoomId(group.classroomId, group.id) },
    classroom: { id: group.classroomId, name: group.classroom.name, writingMode: group.classroom.writingMode },
    members,
  });
});
