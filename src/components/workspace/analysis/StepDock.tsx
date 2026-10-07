"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { springs } from "../../motion";
import { clsx } from "../../ui";

/**
 * 화면 아래에 떠 있는 걸음 전환 막대. 아이콘 위, 짧은 라벨 아래.
 * 선택된 항목 뒤의 연회색 알약이 스프링으로 미끄러진다(헤더 stepper와 같은 방식).
 * role=radiogroup/radio와 aria-label을 유지해 키보드·테스트에서 Segmented와 같게 다뤄진다.
 */
export function StepDock<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { key: T; label: string; icon: LucideIcon; disabled?: boolean }[];
  label: string;
}) {
  return (
    // 좁은 화면에서는 왼쪽 아래 Liveblocks 배지와 겹치지 않도록 한 단 위에 띄운다
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 sm:bottom-6">
      <div role="radiogroup" aria-label={label} className="material-panel pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[1.75rem] p-1.5">
        {items.map((it) => {
          const on = it.key === value;
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={it.label}
              disabled={it.disabled}
              onClick={() => onChange(it.key)}
              className={clsx(
                "pressable relative flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-[1.25rem] px-3 pb-1.5 pt-2 text-[12px] font-medium sm:min-w-[88px] sm:px-4 sm:text-[13px]",
                on ? "text-ink" : "text-ink-2 hover:text-ink",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {on ? <motion.span layoutId="step-dock" className="absolute inset-0 rounded-[1.25rem] bg-paper-2" transition={springs.quick} aria-hidden /> : null}
              <Icon size={22} strokeWidth={1.8} className="relative" aria-hidden />
              <span className="relative whitespace-nowrap leading-none">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
