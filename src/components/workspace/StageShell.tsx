"use client";

import { useUpdateMyPresence } from "@liveblocks/react/suspense";
import { ArrowLeft, Lock } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/client/logger";
import { STAGES, type StageKey } from "@/lib/stages";
import { Logo } from "../Logo";
import { springs } from "../motion";
import { SettingsMenu } from "../SettingsMenu";
import { Badge, clsx } from "../ui";
import { useRoomCtx } from "./context";
import { AnalyzeStage } from "./stages/AnalyzeStage";
import { CollectStage } from "./stages/CollectStage";
import { OrganizeStage } from "./stages/OrganizeStage";
import { PlanStage } from "./stages/PlanStage";
import { ReflectStage } from "./stages/ReflectStage";
import { WriteStage } from "./stages/WriteStage";

/**
 * 상단: 왼쪽 로고 + 수업 제목, 가운데 둥근 막대 stepper, 오른쪽 '설정' 버튼 하나.
 * 학생/둘러보기/교사 화면이 함께 쓴다.
 */
export function StageShell({
  openStages,
  initialStage,
  title,
  badge,
  back,
  settings,
  hideStages = [],
}: {
  openStages: string[];
  initialStage?: string | null;
  /** 수업(학급) 제목 */
  title: string;
  /** 제목 옆 작은 표시 (예: 읽기 전용) */
  badge?: ReactNode;
  /** 뒤로 가기 링크 */
  back?: { href: string; label: string };
  /** 설정 패널 내용 */
  settings: ReactNode;
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
      <header className={clsx("sticky top-0 z-20 transition-[background-color,box-shadow] duration-200", scrolled && "material-thin shadow-[0_1px_0_var(--line)]")}>
        <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-5 lg:grid-cols-[1fr_auto_1fr]">
          {/* 왼쪽: 로고 + 수업 제목 */}
          <div className="flex min-w-0 items-center gap-2.5">
            {back ? (
              <Link href={back.href} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2 hover:bg-paper-3" aria-label={back.label} title={back.label}>
                <ArrowLeft size={18} />
              </Link>
            ) : null}
            <Logo size={44} />
            <div className="flex h-11 min-w-0 items-center gap-2">
              <p className="truncate text-xl font-bold leading-none tracking-tight">{title}</p>
              {badge ? <div className="flex items-center gap-1">{badge}</div> : null}
            </div>
          </div>

          {/* 오른쪽: 설정 */}
          <div className="flex items-center justify-end lg:order-last">
            <SettingsMenu>{settings}</SettingsMenu>
          </div>

          {/* 가운데: 둥근 막대 stepper */}
          <nav aria-label="활동 단계" className="col-span-2 lg:col-span-1 lg:justify-self-center">
            <LayoutGroup id={`stages-${groupId}`}>
              <ol className="pill-bar mx-auto flex h-11 w-fit max-w-full items-center gap-0.5 overflow-x-auto p-1">
                {stages.map((s) => {
                  const open = openStages.includes(s.key);
                  const active = s.key === stage;
                  return (
                    <li key={s.key} className="shrink-0">
                      <button
                        onClick={() => go(s.key)}
                        disabled={!open}
                        aria-current={active ? "step" : undefined}
                        aria-label={`${s.label}${open ? "" : " (잠김)"}`}
                        title={open ? s.desc : "선생님이 아직 열지 않은 단계예요"}
                        className={clsx(
                          "pressable relative flex h-9 items-center gap-1.5 rounded-full px-4 text-[15px]",
                          active ? "font-semibold text-ink" : open ? "font-medium text-ink-2 hover:text-ink" : "cursor-not-allowed font-medium text-ink-3/60",
                        )}
                      >
                        {active ? <motion.span layoutId="stage-pill" className="pill-thumb absolute inset-0 rounded-full" transition={springs.quick} aria-hidden /> : null}
                        <span className="relative hidden lg:inline">{s.label}</span>
                        <span className="relative lg:hidden">{s.short}</span>
                        {!open ? <Lock size={13} className="relative" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </LayoutGroup>
          </nav>
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
            {stage === "analyze" && <AnalyzeStage />}
            {stage === "organize" && <OrganizeStage />}
            {stage === "write" && <WriteStage />}
            {stage === "reflect" && <ReflectStage />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export { Badge as HeaderBadge };

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
