"use client";

import { useUpdateMyPresence } from "@liveblocks/react/suspense";
import { Lock } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/client/logger";
import { STAGES, type StageKey } from "@/lib/stages";
import { springs } from "../motion";
import { ThemeToggle } from "../ThemeToggle";
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
 * 상단 크롬은 반투명 재질로 떠 있고 내용이 그 아래로 스크롤된다.
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
  const stage = (openStages.includes(chosen) ? chosen : firstOpen) as StageKey;
  const scrolled = useScrolled();

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
  const current = stages.find((s) => s.key === stage);

  return (
    <div className="min-h-dvh">
      <header className="material-thin scroll-edge sticky top-0 z-20" data-scrolled={scrolled}>
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0 flex-1">{header}</div>
          <ThemeToggle className="max-sm:hidden" />
          <PresenceBar />
        </div>
        <nav aria-label="활동 단계" className="px-3 pb-2 sm:px-5">
          <LayoutGroup id={`stages-${groupId}`}>
            <ol className="flex gap-1 overflow-x-auto">
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
                        "pressable relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm",
                        active ? "font-semibold text-paper" : open ? "text-ink-2 hover:bg-paper-2" : "cursor-not-allowed text-ink-3/70",
                      )}
                    >
                      {active ? <motion.span layoutId="stage-pill" className="absolute inset-0 rounded-lg bg-ink" transition={springs.quick} aria-hidden /> : null}
                      <span className={clsx("relative text-xs tabular-nums", active ? "text-paper/70" : "text-ink-3")}>{i + 1}</span>
                      <span className="relative">{s.label}</span>
                      {!open ? <Lock size={12} className="relative" /> : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          </LayoutGroup>
        </nav>
      </header>
      <main className="px-4 py-6 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={springs.quick}
          >
            <p className="sr-only">{current?.desc}</p>
            {stage === "plan" && <PlanStage />}
            {stage === "collect" && <CollectStage />}
            {stage === "analyze" && <AnalyzeStage onGoNext={openStages.includes("generate") ? () => go("generate") : undefined} />}
            {stage === "generate" && <GenerateStage onGoAnalyze={openStages.includes("analyze") ? () => go("analyze") : undefined} />}
            {stage === "organize" && <OrganizeStage />}
            {stage === "write" && <WriteStage />}
            {stage === "reflect" && <ReflectStage />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/** 떠 있는 크롬 아래로 내용이 들어갔을 때만 가장자리 효과를 켠다 */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none";
    document.body.prepend(sentinel);
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting));
    io.observe(sentinel);
    return () => {
      io.disconnect();
      sentinel.remove();
    };
  }, []);
  return scrolled;
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
