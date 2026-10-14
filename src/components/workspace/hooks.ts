"use client";

import { useBroadcastEvent, useEventListener } from "@liveblocks/react/suspense";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client/api";
import type { Material, RunFull, RunSummary } from "./types";

/*
 * 화면 사이에서 함께 쓰는 서버 데이터 보관소.
 * - 한 번 받은 자료 목록·분석 기록은 여기에 두고, 단계를 다시 열면 바로 보여 준 뒤 뒤에서 조용히 새로 받는다.
 * - 같은 주소를 여러 부품이 동시에 부르면 요청 하나로 합친다.
 * - 다른 모둠원이 바꾸면 방 이벤트로 강제로 다시 받는다.
 */
type Entry = { data: unknown; error: string | null; fetchedAt: number };
const EMPTY: Entry = { data: null, error: null, fetchedAt: 0 };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Map<string, Set<() => void>>();
/** 이 시간 안에 받은 적이 있으면 다시 열 때 새로 받지 않는다 (동시에 열리는 부품들의 중복 요청 방지) */
const FRESH_MS = 3000;

function emit(url: string) {
  listeners.get(url)?.forEach((f) => f());
}

export function fetchResource(url: string, force = false): Promise<void> {
  const running = inflight.get(url);
  if (running) return running;
  const cur = store.get(url);
  if (!force && cur && cur.data !== null && Date.now() - cur.fetchedAt < FRESH_MS) return Promise.resolve();
  const p = api<unknown>(url)
    .then((data) => {
      store.set(url, { data, error: null, fetchedAt: Date.now() });
    })
    .catch((e) => {
      store.set(url, { ...(store.get(url) ?? EMPTY), error: (e as Error).message });
    })
    .finally(() => {
      inflight.delete(url);
      emit(url);
    });
  inflight.set(url, p);
  return p;
}

function peek<T>(url: string): T | null {
  return (store.get(url)?.data as T | undefined) ?? null;
}

function useResource<T>(url: string | null, eventType: "materials-changed" | "runs-changed" | null) {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!url) return () => {};
      const set = listeners.get(url) ?? new Set();
      set.add(cb);
      listeners.set(url, set);
      return () => {
        set.delete(cb);
      };
    },
    [url],
  );
  const entry = useSyncExternalStore(
    subscribe,
    () => (url ? (store.get(url) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );

  // 열 때마다 뒤에서 새로 받는다(이미 있는 데이터는 그대로 보여 준다)
  useEffect(() => {
    if (url) fetchResource(url);
  }, [url]);

  useEventListener(({ event }) => {
    if (url && eventType && event.type === eventType) fetchResource(url, true);
  });

  const broadcast = useBroadcastEvent();
  const reload = useCallback(() => (url ? fetchResource(url, true) : Promise.resolve()), [url]);
  const notify = useCallback(() => {
    if (eventType) broadcast({ type: eventType });
    return reload();
  }, [broadcast, eventType, reload]);

  return { data: entry.data as T | null, error: entry.error, reload, notify };
}

const materialsUrl = (groupId: string) => `/api/materials?groupId=${groupId}`;
const runsUrl = (groupId: string) => `/api/runs?groupId=${groupId}`;
const DEFAULTS_URL = "/api/analysis/defaults";

/** 모둠 자료 목록. 다른 모둠원이 바꾸면 방 이벤트로 다시 불러온다. */
export function useMaterials(groupId: string) {
  const r = useResource<{ materials: Material[] }>(materialsUrl(groupId), "materials-changed");
  return { materials: r.data?.materials ?? null, error: r.error, reload: r.reload, notify: r.notify };
}

export function useRuns(groupId: string) {
  const r = useResource<{ runs: RunSummary[] }>(runsUrl(groupId), "runs-changed");
  return { runs: r.data?.runs ?? null, error: r.error, reload: r.reload, notify: r.notify };
}

/** 분석 기본값(불용어·방법). 거의 바뀌지 않아 한 번 받으면 계속 쓴다. 둘러보기(읽기 전용)는 부르지 않는다. */
export function useAnalysisDefaults(enabled: boolean) {
  const r = useResource<{ stopwords: string[]; methods: string[] }>(enabled ? DEFAULTS_URL : null, null);
  return { defaults: r.data, error: r.error };
}

const runCache = new Map<string, RunFull>();
const runInflight = new Map<string, Promise<RunFull>>();

function loadRun(runId: string) {
  const cached = runCache.get(runId);
  if (cached) return Promise.resolve(cached);
  const running = runInflight.get(runId);
  if (running) return running;
  const p = api<{ run: RunFull }>(`/api/runs/${runId}`)
    .then(({ run }) => {
      runCache.set(runId, run);
      return run;
    })
    .finally(() => runInflight.delete(runId));
  runInflight.set(runId, p);
  return p;
}

export function useRun(runId: string | null) {
  const [run, setRun] = useState<RunFull | null>(runId ? (runCache.get(runId) ?? null) : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!runId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 선택이 바뀌면 결과를 비운다
      setRun(null);
      return;
    }
    const cached = runCache.get(runId);
    if (cached) {
      setRun(cached);
      return;
    }
    let alive = true;
    setRun(null);
    loadRun(runId)
      .then((r) => alive && setRun(r))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [runId]);
  return { run, error };
}

/** 방금 만든 분석 결과를 캐시에 넣어 두어 결과 창들이 바로 그린다 */
export function primeRunCache(run: RunFull) {
  runCache.set(run.id, run);
}

export function updateRunCache(runId: string, patch: Partial<RunFull>) {
  const r = runCache.get(runId);
  if (r) runCache.set(runId, { ...r, ...patch });
}

/**
 * 작업 공간에 들어오면 단계마다 쓰는 데이터를 미리 받아 둔다.
 * 자료 목록, 분석 기록, (쓰기 가능하면) 분석 기본값, 가장 최근 분석 결과.
 */
export function prefetchGroup(groupId: string, canEdit: boolean) {
  fetchResource(materialsUrl(groupId));
  if (canEdit) fetchResource(DEFAULTS_URL);
  fetchResource(runsUrl(groupId)).then(() => {
    const latest = peek<{ runs: RunSummary[] }>(runsUrl(groupId))?.runs[0];
    if (latest) loadRun(latest.id).catch(() => {});
  });
}
