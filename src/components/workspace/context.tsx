"use client";

import { createContext, useContext } from "react";
import type { Me } from "./types";

/**
 * 지금 보고 있는 모둠 방의 맥락.
 * 학생 본인 모둠: canEdit=true / 다른 모둠 둘러보기: canEdit=false / 교사: canEdit=true(댓글 등)
 */
export type RoomCtx = {
  me: Me | null;
  viewer: { id: string; name: string; role: "student" | "teacher" };
  groupId: string;
  groupName: string;
  classroomId: string;
  members: { id: string; name: string }[];
  writingMode: "group" | "individual" | "both";
  canEdit: boolean;
  /** 댓글을 쓸 수 있는지 (교사는 내용은 읽기 전용, 댓글은 가능) */
  canComment: boolean;
  isOwnGroup: boolean;
};

const Ctx = createContext<RoomCtx | null>(null);

export const RoomCtxProvider = Ctx.Provider;

export function useRoomCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("RoomCtx missing");
  return v;
}

/** Liveblocks 사용자 id 규칙 */
export const userKey = (role: "student" | "teacher", id: string) => `${role === "student" ? "s" : "t"}:${id}`;
