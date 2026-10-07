"use client";

/**
 * 연구용 활동 로그를 브라우저에서 모아 5초마다(또는 화면을 떠날 때) 보낸다.
 * 서버 API가 직접 기록하는 사건(자료 등록, 분석 실행 등)은 여기서 다시 보내지 않는다.
 */
type Pending = {
  type: string;
  stage?: string | null;
  payload?: Record<string, unknown>;
  at: number;
  groupId?: string | null;
};

let queue: Pending[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let classroomId: string | undefined;

function flush(useBeacon = false) {
  if (!queue.length) return;
  const events = queue.splice(0, 100);
  const body = JSON.stringify({ events, classroomId });
  if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "text/plain" }));
    return;
  }
  fetch("/api/events", { method: "POST", body, keepalive: true }).catch(() => {
    queue = events.concat(queue).slice(0, 1000); // 실패하면 다시 넣는다
  });
}

function ensureTimer() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => flush(), 5000);
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
}

/** 교사 화면에서 로그를 남길 때 학급을 지정 */
export function setLogClassroom(id: string) {
  classroomId = id;
}

export function track(type: string, payload?: Record<string, unknown>, opts?: { stage?: string | null; groupId?: string | null }) {
  ensureTimer();
  queue.push({ type, payload, stage: opts?.stage ?? null, groupId: opts?.groupId, at: Date.now() });
  if (queue.length >= 50) flush();
}

/** 같은 대상에 대한 연속 입력(이름 고치기 등)을 마지막 값 하나로 묶어 기록 */
const debounced = new Map<string, ReturnType<typeof setTimeout>>();
export function trackDebounced(
  key: string,
  type: string,
  payload: Record<string, unknown>,
  opts?: { stage?: string | null; delay?: number },
) {
  const prev = debounced.get(key);
  if (prev) clearTimeout(prev);
  debounced.set(
    key,
    setTimeout(() => {
      debounced.delete(key);
      track(type, payload, opts);
    }, opts?.delay ?? 1500),
  );
}
