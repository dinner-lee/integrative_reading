import { NextResponse } from "next/server";
import { handle, requireOwnClassroom } from "@/lib/auth";
import { db } from "@/lib/db";
import { newInviteCode } from "@/lib/invite";

type Ctx = { params: Promise<{ id: string }> };

/** 초대 코드 새로 만들기 (이전 코드·링크는 더 이상 쓸 수 없음, 이미 들어온 학생은 그대로) */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireOwnClassroom(id);
  const classroom = await db.classroom.update({ where: { id }, data: { inviteCode: await newInviteCode() } });
  return NextResponse.json({ inviteCode: classroom.inviteCode });
});
