import type { LiveList, LiveMap, LiveObject } from "@liveblocks/client";

export type Decision = "undecided" | "selected" | "hold" | "excluded";

export type ClusterData = {
  id: string;
  name: string;
  /** 이 묶음의 공통점·쓸모에 대한 모둠 메모 */
  note: string;
  /** 분석이 뽑은 대표 낱말 (참고용, 고정) */
  keywords: string[];
  origin: "ai" | "human";
  materialIds: LiveList<string>;
};

export type DecisionData = {
  status: Decision;
  reason: string;
  updatedBy: string;
  updatedAt: number;
};

export type SectionData = {
  id: string;
  title: string;
  role: "intro" | "body" | "conclusion";
  /** 이 부분에서 전할 중심 내용 */
  point: string;
  materialIds: LiveList<string>;
};

export type MemberPlan = { purpose: string; audience: string; questions: string };

declare global {
  interface Liveblocks {
    Presence: {
      stage: string | null;
      /** 지금 보고 있는 대상(묶음 id, 개요 칸 id 등) */
      focus: string | null;
    };
    Storage: {
      plan: LiveObject<{ topic: string; purpose: string; audience: string; format: string }>;
      memberPlans: LiveMap<string, LiveObject<MemberPlan>>;
      board: LiveObject<{ runId: string | null; method: string | null; adoptedAt: number; adoptedBy: string }>;
      /** 배열 순서 = 우선순위 */
      clusters: LiveList<LiveObject<ClusterData>>;
      decisions: LiveMap<string, LiveObject<DecisionData>>;
      outline: LiveList<LiveObject<SectionData>>;
      /** 편집기 field별 글 제목 (예전 방에는 없을 수 있음) */
      titles?: LiveMap<string, string>;
    };
    UserMeta: {
      id: string;
      info: { name: string; color: string; role: "student" | "teacher"; groupName?: string };
    };
    RoomEvent: { type: "materials-changed" } | { type: "runs-changed" };
    ThreadMetadata: {
      stage: string;
      /** 묶음 id, 개요 칸 id, 편집기 field 등 */
      target: string;
    };
    RoomInfo: { name: string };
  }
}

export {};
