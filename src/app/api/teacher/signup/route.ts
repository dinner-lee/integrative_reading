import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handle } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요."),
  name: z.string().trim().min(1).max(30),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 해요.").max(100),
  signupCode: z.string().optional(),
});

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.");
  const { email, name, password, signupCode } = parsed.data;
  const required = process.env.TEACHER_SIGNUP_CODE;
  if (required && signupCode !== required) throw new ApiError(403, "교사 가입 코드가 맞지 않아요.");
  if (await db.teacher.findUnique({ where: { email } })) throw new ApiError(409, "이미 가입한 이메일이에요.");
  const teacher = await db.teacher.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10) },
  });
  await createSession({ role: "teacher", teacherId: teacher.id });
  return NextResponse.json({ ok: true });
});
