import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireOwnClassroom } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ name: z.string().trim().min(1).max(30).optional() });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireOwnClassroom(id);
  const { name } = Body.parse(await req.json().catch(() => ({})));
  const count = await db.group.count({ where: { classroomId: id } });
  const group = await db.group.create({
    data: { classroomId: id, name: name ?? `${count + 1}모둠`, order: count },
  });
  return NextResponse.json({ group });
});
