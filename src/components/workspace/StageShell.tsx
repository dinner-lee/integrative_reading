"use client";

import { useUpdateMyPresence } from "@liveblocks/react/suspense";
import { Lock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/client/logger";
import { STAGES, type StageKey } from "@/lib/stages";
import { clsx } from "../ui";
import { useRoomCtx } from "./context";
import { PresenceBar } from "./Presence";
import { AnalyzeStage } from "./stages/AnalyzeStage";
import { CollectStage } from "./stages/CollectStage";
import { GenerateStage } from "./stages/GenerateStage";
import { OrganizeStage } from "./stages/OrganizeStage";
import { PlanStage } from "./stages/PlanStage";
import { ReflectStage } from "./stages/ReflectStage";
import { WriteStage } from "./stages/WriteStage";

/**
 * 단계 탭 + 단계 화면. 학생/둘러보기/교사 화면이 함께 쓴다.
 * openStages에 없는 단계는 잠겨 보인다.
 */
export function StageShell({
  openStages,
  initialStage,
  header,
  hideStages = [],
}: {
  openStages: string[];
  initialStage?: string | null;
  header: ReactNode;
  hideStages?: StageKey[];
}) {
  const { groupId, isOwnGroup } = useRoomCtx();
  const stages = STAGES.filter((s) => !hideStages.includes(s.key));
  const firstOpen = stages.find((s) => openStages.includes(s.key))?.key ?? "plan";
  const [chosen, setStage] = useState<StageKey>(() => {
    const saved = initialStage ?? (typeof window !== "undefined" ? localStorageGet(`stage:${groupId}`) : null);
    return (stages.find((s) => s.key === saved && openStages.includes(s.key))?.key ?? firstOpen) as StageKey;
  });
  const updatePresence = useUpdateMyPresence();
  const enteredAt = useRef(0);
  // 교사가 단계를 닫으면 열린 첫 단계를 보여 준다
  const stage = (openStages.includes(chosen) ? chosen : firstOpen) as StageKey;

  useEffect(() => {
    updatePresence({ stage, focus: null });
    enteredAt.current = Date.now();
    const peer = isOwnGroup ? undefined : groupId;
    track("stage.enter", { stage, peer }, { stage, groupId: peer });
    localStorageSet(`stage:${groupId}`, stage);
    window.scrollTo({ top: 0 });
    return () => {
      track("stage.leave", { stage, ms: Date.now() - enteredAt.current, peer }, { stage, groupId: peer });
    };
  }, [stage, updatePresence, groupId, isOwnGroup]);

  const go = (k: StageKey) => openStages.includes(k) && setStage(k);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0 flex-1">{header}</div>
          <PresenceBar />
        </div>
      </header>
      <nav className="border-b border-line bg-surface" aria-label="활동 단계">
        <ol className="flex gap-1 overflow-x-auto px-3 py-2 sm:px-5">
          {stages.map((s, i) => {
            const open = openStages.includes(s.key);
            const active = s.key === stage;
            return (
              <li key={s.key} className="shrink-0">
                <button
                  onClick={() => go(s.key)}
                  disabled={!open}
                  aria-current={active ? "step" : undefined}
                  title={open ? s.desc : "선생님이 아직 열지 않은 단계예요"}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-ink font-semibold text-white" : open ? "text-ink-2 hover:bg-[#efede6]" : "cursor-not-allowed text-ink-3/70",
                  )}
                >
                  <span className={clsx("text-xs tabular-nums", active ? "text-white/70" : "text-ink-3")}>{i + 1}</span>
                  {s.label}
                  {!open ? <Lock size={12} /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <main className="px-4 py-6 sm:px-6">
        {stage === "plan" && <PlanStage />}
        {stage === "collect" && <CollectStage />}
        {stage === "analyze" && <AnalyzeStage onGoNext={openStages.includes("generate") ? () => go("generate") : undefined} />}
        {stage === "generate" && <GenerateStage onGoAnalyze={openStages.includes("analyze") ? () => go("analyze") : undefined} />}
        {stage === "organize" && <OrganizeStage />}
        {stage === "write" && <WriteStage />}
        {stage === "reflect" && <ReflectStage />}
      </main>
    </div>
  );
}

function localStorageGet(k: string) {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}
function localStorageSet(k: string, v: string) {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* 저장 못 해도 괜찮음 */
  }
}
