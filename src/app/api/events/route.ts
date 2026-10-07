import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, getStudentContext, getTeacher, handle } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvents, type LogInput } from "@/lib/log";

const Event = z.object({
  type: z.string().min(1).max(60),
  stage: z.string().max(20).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  at: z.number().optional(),
  /** 다른 모둠 방에서 일어난 사건(둘러보기 등) */
  groupId: z.string().nullable().optional(),
});

const Body = z.object({
  events: z.array(Event).max(100),
  classroomId: z.string().optional(),
});

/** 브라우저에서 모아 보낸 활동 로그 (sendBeacon 대응을 위해 text/plain도 받음) */
export const POST = handle(async (req: Request) => {
  const raw = await req.text();
  const body = Body.parse(JSON.parse(raw || "{}"));
  if (!body.events.length) return NextResponse.json({ ok: true });

  let base: Omit<LogInput, "type">;
  const st = await getStudentContext();
  if (st) {
    base = { classroomId: st.classroomId, groupId: st.groupId, actorType: "student", actorId: st.id, actorName: st.name };
  } else {
    const t = await getTeacher();
    if (!t || !body.classroomId) throw new ApiError(401, "unauthorized");
    const own = await db.classroom.findFirst({ where: { id: body.classroomId, teacherId: t.id }, select: { id: true } });
    if (!own) throw new ApiError(403, "forbidden");
    base = { classroomId: own.id, groupId: null, actorType: "teacher", actorId: t.id, actorName: t.name };
  }

  await logEvents(
    body.events.map((e) => ({
      ...base,
      groupId: e.groupId ?? base.groupId,
      type: e.type,
      stage: e.stage ?? null,
      payload: (e.payload ?? {}) as object,
      clientAt: e.at ? new Date(e.at) : null,
    })),
  );
  return NextResponse.json({ ok: true });
});
