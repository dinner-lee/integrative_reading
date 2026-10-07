import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handle } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { createSession } from "@/lib/session";

const Body = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1, "이름을 적어 주세요.").max(20, "이름은 20자까지 쓸 수 있어요."),
});

/** 초대 코드로 학급을 찾고, 같은 이름이 있으면 그 학생으로 다시 입장한다. */
export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.");
  const code = parsed.data.code.toUpperCase();
  const name = parsed.data.name.replace(/\s+/g, " ");

  const classroom = await db.classroom.findUnique({ where: { inviteCode: code } });
  if (!classroom || classroom.archived) throw new ApiError(404, "초대 코드가 맞지 않아요. 선생님께 다시 확인해 주세요.");

  const existing = await db.student.findUnique({
    where: { classroomId_name: { classroomId: classroom.id, name } },
  });
  const student =
    existing ??
    (await db.student.create({ data: { classroomId: classroom.id, name } }));
  if (existing) await db.student.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });

  await createSession({ role: "student", studentId: student.id, classroomId: classroom.id });
  await logEvent({
    classroomId: classroom.id,
    groupId: student.groupId,
    actorType: "student",
    actorId: student.id,
    actorName: student.name,
    type: existing ? "auth.rejoin" : "auth.join",
  });
  return NextResponse.json({ ok: true, rejoined: Boolean(existing) });
});
