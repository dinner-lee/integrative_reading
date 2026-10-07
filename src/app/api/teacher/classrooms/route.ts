import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handle, requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { newInviteCode } from "@/lib/invite";

export const GET = handle(async () => {
  const t = await requireTeacher();
  const classrooms = await db.classroom.findMany({
    where: { teacherId: t.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { students: true, groups: true } } },
  });
  return NextResponse.json({ classrooms });
});

const Body = z.object({
  name: z.string().trim().min(1, "학급 이름을 적어 주세요.").max(60),
  groupCount: z.number().int().min(0).max(20).default(0),
});

export const POST = handle(async (req: Request) => {
  const t = await requireTeacher();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.");
  const classroom = await db.classroom.create({
    data: {
      teacherId: t.id,
      name: parsed.data.name,
      inviteCode: await newInviteCode(),
      groups: {
        create: Array.from({ length: parsed.data.groupCount }, (_, i) => ({ name: `${i + 1}모둠`, order: i })),
      },
    },
  });
  return NextResponse.json({ classroom });
});
