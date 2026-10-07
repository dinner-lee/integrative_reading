import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type LogInput = {
  classroomId: string;
  groupId?: string | null;
  actorType: "student" | "teacher";
  actorId: string;
  actorName?: string | null;
  stage?: string | null;
  type: string;
  payload?: Prisma.InputJsonValue;
  clientAt?: Date | null;
};

/** 연구용 로그. 기록 실패가 학습 활동을 막지 않도록 오류는 삼킨다. */
export async function logEvent(e: LogInput) {
  try {
    await db.eventLog.create({ data: e });
  } catch (err) {
    console.error("logEvent failed", err);
  }
}

export async function logEvents(events: LogInput[]) {
  if (!events.length) return;
  try {
    await db.eventLog.createMany({ data: events });
  } catch (err) {
    console.error("logEvents failed", err);
  }
}
