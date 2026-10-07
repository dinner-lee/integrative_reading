"use client";

import { useUpdateMyPresence } from "@liveblocks/react/suspense";
import { BookOpen, Boxes, ChartScatter, ListTree, Lock, PenLine, Sparkles, Target } from "lucide-react";
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

const ICONS: Record<StageKey, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  plan: Target,
  collect: BookOpen,
  analyze: ChartScatter,
  generate: Boxes,
  organize: ListTree,
  write: PenLine,
  reflect: Sparkles,
};

/**
 * 상단 크롬 + 단계 stepper + 단계 화면. 학생/둘러보기/교사 화면이 함께 쓴다.
 * stepper는 둥근 알약 막대 안에 아이콘+라벨로 들어가고, 선택 표시가 스프링으로 미끄러진다.
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
      <header className={clsx("sticky top-0 z-20 transition-[background-color] duration-200", scrolled && "material-thin")}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-5 lg:flex-nowrap">
          <div className="min-w-0 flex-1 lg:flex-none">{header}</div>

          <nav aria-label="활동 단계" className="order-last w-full lg:order-none lg:w-auto lg:flex-1">
            <LayoutGroup id={`stages-${groupId}`}>
              <ol className="pill-bar mx-auto flex w-fit max-w-full items-center gap-0.5 overflow-x-auto p-1">
                {stages.map((s) => {
                  const open = openStages.includes(s.key);
                  const active = s.key === stage;
                  const Icon = ICONS[s.key];
                  return (
                    <li key={s.key} className="shrink-0">
                      <button
                        onClick={() => go(s.key)}
                        disabled={!open}
                        aria-current={active ? "step" : undefined}
                        aria-label={`${s.label}${open ? "" : " (잠김)"}`}
                        title={open ? s.desc : "선생님이 아직 열지 않은 단계예요"}
                        className={clsx(
                          "pressable relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 sm:min-w-[72px]",
                          active ? "text-ink" : open ? "text-ink-2 hover:text-ink" : "cursor-not-allowed text-ink-3/60",
                        )}
                      >
                        {active ? <motion.span layoutId="stage-pill" className="absolute inset-0 rounded-full bg-paper-3/80" transition={springs.quick} aria-hidden /> : null}
                        <span className="relative flex h-5 items-center">
                          {open ? <Icon size={18} strokeWidth={active ? 2.2 : 1.8} /> : <Lock size={16} strokeWidth={1.8} />}
                        </span>
                        <span className={clsx("relative text-[11px] leading-none", active ? "font-semibold" : "font-medium")}>{s.short}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </LayoutGroup>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="max-sm:hidden" />
            <div className="pill-bar flex h-9 items-center px-1.5">
              <PresenceBar />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={springs.quick}
          >
            <p className="sr-only">
              {current?.label}. {current?.desc}
            </p>
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

/** 내용이 크롬 아래로 들어갔을 때만 재질을 켠다 */
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
