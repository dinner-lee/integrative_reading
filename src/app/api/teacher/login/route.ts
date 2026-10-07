import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handle } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

const Body = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });

export const POST = handle(async (req: Request) => {
  const { email, password } = Body.parse(await req.json());
  const teacher = await db.teacher.findUnique({ where: { email } });
  if (!teacher || !(await bcrypt.compare(password, teacher.passwordHash))) {
    throw new ApiError(401, "이메일 또는 비밀번호가 맞지 않아요.");
  }
  await createSession({ role: "teacher", teacherId: teacher.id });
  return NextResponse.json({ ok: true });
});
