"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { springs } from "./motion";
import { clsx } from "./ui";

type Toast = {
  id: number;
  message: ReactNode;
  tone: "neutral" | "ok" | "bad";
  action?: { label: string; onClick: () => void };
};

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"]; duration?: number };

const Ctx = createContext<{ toast: (t: ToastInput) => void } | null>(null);

/** 짧은 완료·상태 알림. 되돌리기 같은 한 가지 행동을 붙일 수 있다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-2), { id, message: t.message, tone: t.tone ?? "neutral", action: t.action }]);
      window.setTimeout(() => dismiss(id), t.duration ?? (t.action ? 7000 : 3500));
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={springs.default}
              className={clsx(
                "material-heavy pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-card",
                t.tone === "ok" && "text-ok",
                t.tone === "bad" && "text-bad",
              )}
            >
              <span className="text-ink">{t.message}</span>
              {t.action ? (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="shrink-0 rounded-lg px-2 py-1 font-semibold text-accent hover:bg-paper-2 active:scale-[0.97]"
                >
                  {t.action.label}
                </button>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("ToastProvider missing");
  return v.toast;
}
