"use client";

import { useBroadcastEvent, useEventListener } from "@liveblocks/react/suspense";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Material, RunFull, RunSummary } from "./types";

function useResource<T>(url: string | null, eventType: "materials-changed" | "runs-changed") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!url) return;
    try {
      setData(await api<T>(url));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 API에서 불러오기
    load();
  }, [load]);

  useEventListener(({ event }) => {
    if (event.type === eventType) load();
  });

  const broadcast = useBroadcastEvent();
  const notify = useCallback(() => {
    broadcast({ type: eventType });
    return load();
  }, [broadcast, eventType, load]);

  return { data, error, reload: load, notify };
}

/** 모둠 자료 목록. 다른 모둠원이 바꾸면 방 이벤트로 다시 불러온다. */
export function useMaterials(groupId: string) {
  const r = useResource<{ materials: Material[] }>(`/api/materials?groupId=${groupId}`, "materials-changed");
  return { materials: r.data?.materials ?? null, error: r.error, reload: r.reload, notify: r.notify };
}

export function useRuns(groupId: string) {
  const r = useResource<{ runs: RunSummary[] }>(`/api/runs?groupId=${groupId}`, "runs-changed");
  return { runs: r.data?.runs ?? null, error: r.error, reload: r.reload, notify: r.notify };
}

const runCache = new Map<string, RunFull>();

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
    api<{ run: RunFull }>(`/api/runs/${runId}`)
      .then(({ run }) => {
        runCache.set(runId, run);
        if (alive) setRun(run);
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [runId]);
  return { run, error };
}

export function updateRunCache(runId: string, patch: Partial<RunFull>) {
  const r = runCache.get(runId);
  if (r) runCache.set(runId, { ...r, ...patch });
}
