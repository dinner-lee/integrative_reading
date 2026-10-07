"use client";

import { Settings } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { springs } from "./motion";
import { clsx } from "./ui";

/**
 * 톱니바퀴 '설정' 버튼 하나에 모둠·학급 정보, 접속자, 다른 모둠 보기, 화면 모드, 로그아웃을 모은다.
 * 패널은 버튼(오른쪽 위)에서 자라나고, 바깥을 누르거나 Esc로 닫힌다.
 */
export function SettingsMenu({ children, label = "설정" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        className={clsx(
          "pressable flex h-11 w-11 items-center justify-center rounded-full bg-paper-2 text-ink-2 hover:bg-paper-3 hover:text-ink",
          open && "bg-paper-3 text-ink",
        )}
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={springs.quick} className="flex">
          <Settings size={18} strokeWidth={1.9} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={id}
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -2, transition: { duration: 0.12 } }}
            transition={springs.quick}
            style={{ transformOrigin: "top right" }}
            className="material-panel absolute right-0 top-13 z-40 w-[min(320px,calc(100vw-2rem))] rounded-[var(--radius-panel)] p-2 text-ink"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** 설정 패널 안의 묶음 */
export function MenuSection({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("px-2 py-2 [&+&]:border-t [&+&]:border-line", className)}>
      {title ? <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3> : null}
      {children}
    </section>
  );
}

export function MenuItem({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={clsx("pressable flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-ink hover:bg-paper-2", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
