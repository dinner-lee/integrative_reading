import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handle, requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";

const Body = z.object({ groupId: z.string().min(1) });

/** 선생님이 허용한 경우 학생이 직접 모둠을 고른다. */
export const POST = handle(async (req: Request) => {
  const st = await requireStudent();
  if (!st.classroom.selfSelectGroup) throw new ApiError(403, "모둠은 선생님이 정해 주세요.");
  const { groupId } = Body.parse(await req.json());
  const group = await db.group.findFirst({ where: { id: groupId, classroomId: st.classroomId } });
  if (!group) throw new ApiError(404, "모둠을 찾을 수 없어요.");
  await db.student.update({ where: { id: st.id }, data: { groupId } });
  await logEvent({
    classroomId: st.classroomId,
    groupId,
    actorType: "student",
    actorId: st.id,
    actorName: st.name,
    type: "group.self_select",
    payload: { from: st.groupId, to: groupId },
  });
  return NextResponse.json({ ok: true });
});
