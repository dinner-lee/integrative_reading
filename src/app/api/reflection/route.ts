import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";

export const GET = handle(async () => {
  const st = await requireStudent();
  const r = await db.reflection.findUnique({ where: { studentId: st.id } });
  return NextResponse.json({ answers: (r?.answers as Record<string, string>) ?? {}, updatedAt: r?.updatedAt ?? null });
});

const Body = z.object({ answers: z.record(z.string(), z.string().max(5000)) });

export const PUT = handle(async (req: Request) => {
  const st = await requireStudent();
  const { answers } = Body.parse(await req.json());
  const r = await db.reflection.upsert({
    where: { studentId: st.id },
    create: { studentId: st.id, answers },
    update: { answers },
  });
  await logEvent({
    classroomId: st.classroomId,
    groupId: st.groupId,
    actorType: "student",
    actorId: st.id,
    actorName: st.name,
    stage: "reflect",
    type: "reflection.save",
    payload: { answers },
  });
  return NextResponse.json({ updatedAt: r.updatedAt });
});
