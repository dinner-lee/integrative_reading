"use client";

import { LiveObject } from "@liveblocks/client";
import { useMutation, useStorage } from "@liveblocks/react/suspense";
import { useCallback, useMemo } from "react";
import { trackDebounced } from "@/lib/client/logger";
import type { SharedConditions } from "../../../../liveblocks.config";
import type { Material } from "../types";
import type { Conditions } from "./Conditions";

/**
 * 분석 조건(방법·묶음 수·품사·불용어·넣을 자료)을 모둠이 함께 쓴다.
 * 아직 아무도 바꾸지 않았으면 서버 기본값을 보여 주고, 처음 바꾸는 순간 방에 저장한다.
 */
export function useSharedConditions(materials: Material[] | null, defaults: { stopwords: string[]; methods: string[] } | null) {
  const stored = useStorage((root) => root.analysis?.cond ?? null);

  const cond = useMemo<Conditions | null>(() => {
    if (!materials || !defaults) return null;
    const first = (defaults.methods[0] as Conditions["method"]) ?? "tfidf_kmeans";
    const base = stored ?? {
      method: first,
      excludedIds: [],
      preprocess: { pos: "nouns" as const, stopwords: defaults.stopwords, minLength: 1 },
      mining: { k: null, minDf: 1, maxDf: 1, ngram: 1 as const },
    };
    const excluded = new Set(base.excludedIds);
    return {
      // 교사가 방법을 꺼 두었으면 켜진 첫 방법으로
      method: defaults.methods.includes(base.method) ? base.method : first,
      materialIds: materials.filter((m) => !excluded.has(m.id)).map((m) => m.id),
      preprocess: { ...base.preprocess, stopwords: [...base.preprocess.stopwords] },
      mining: { ...base.mining },
    };
  }, [stored, materials, defaults]);

  const write = useMutation(({ storage }, next: Conditions, allIds: string[]) => {
    const keep = new Set(next.materialIds);
    const value: SharedConditions = {
      method: next.method,
      excludedIds: allIds.filter((id) => !keep.has(id)),
      preprocess: { ...next.preprocess, stopwords: [...next.preprocess.stopwords] },
      mining: { ...next.mining },
    };
    const a = storage.get("analysis");
    if (a) a.set("cond", value);
    else storage.set("analysis", new LiveObject({ cond: value }));
  }, []);

  const setCond = useCallback(
    (next: Conditions) => {
      write(
        next,
        (materials ?? []).map((m) => m.id),
      );
      trackDebounced(
        "analysis.condition",
        "analysis.condition_change",
        {
          method: next.method,
          k: next.mining.k,
          pos: next.preprocess.pos,
          stopwords: next.preprocess.stopwords.length,
          materials: next.materialIds.length,
          minDf: next.mining.minDf,
          ngram: next.mining.ngram,
        },
        { stage: "analyze" },
      );
    },
    [write, materials],
  );

  return [cond, setCond] as const;
}
