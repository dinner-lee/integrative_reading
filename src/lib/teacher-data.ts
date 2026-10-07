import "server-only";
import { db } from "./db";
import { liveblocks } from "./liveblocks-server";
import { groupRoomId } from "./rooms";

export type BoardJson = {
  plan?: { topic?: string; purpose?: string; audience?: string; format?: string };
  memberPlans?: Record<string, { purpose?: string; audience?: string; questions?: string }>;
  board?: { runId?: string | null; method?: string | null; adoptedAt?: number };
  clusters?: { id: string; name: string; note: string; keywords: string[]; origin: string; materialIds: string[] }[];
  decisions?: Record<string, { status: string; reason: string; updatedBy: string; updatedAt: number }>;
  outline?: { id: string; title: string; role: string; point: string; materialIds: string[] }[];
};

/** 모둠 방의 Liveblocks Storage를 JSON으로 읽는다. 방이 아직 없으면 빈 값. */
export async function readBoard(classroomId: string, groupId: string): Promise<BoardJson> {
  try {
    return (await liveblocks().getStorageDocument(groupRoomId(classroomId, groupId), "json")) as unknown as BoardJson;
  } catch {
    return {};
  }
}

/** 편집기 field별 가장 최근 초고 스냅숏 (클라이언트가 주기적으로 기록) */
export async function latestDrafts(classroomId: string) {
  const rows = await db.eventLog.findMany({
    where: { classroomId, type: "draft.snapshot" },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: { groupId: true, payload: true, createdAt: true, actorName: true },
  });
  const latest = new Map<string, { groupId: string | null; field: string; text: string; chars: number; at: Date; by: string | null }>();
  for (const r of rows) {
    const p = (r.payload ?? {}) as { field?: string; text?: string; chars?: number };
    if (!p.field) continue;
    const key = `${r.groupId}:${p.field}`;
    if (!latest.has(key)) {
      latest.set(key, { groupId: r.groupId, field: p.field, text: p.text ?? "", chars: p.chars ?? 0, at: r.createdAt, by: r.actorName });
    }
  }
  return [...latest.values()];
}
