"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, type PanInfo } from "motion/react";
import { createPortal } from "react-dom";
import { forwardRef, useEffect, useId, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { project, rubberband, springs } from "./motion";

export { clsx };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};

/** 누르는 순간(pointer-down) 바로 반응한다. 놓을 때가 아니라. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "pressable inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] font-medium select-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-primary text-on-primary hover:bg-accent-hover active:bg-accent-active",
        variant === "secondary" && "bg-paper-2 text-ink hover:bg-paper-3 active:bg-paper-3",
        variant === "ghost" && "text-ink-2 hover:bg-paper-2 active:bg-paper-3",
        variant === "danger" && "bg-bad-soft text-bad hover:bg-bad/15",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(
        "h-11 w-full rounded-[var(--field-radius)] border border-field-border bg-field px-3.5 text-[15px] text-ink shadow-[0_0_0_1px_var(--line)] placeholder:text-ink-3",
        "focus:outline-none focus:shadow-[0_0_0_2px_var(--focus)] disabled:bg-paper-2",
        className,
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        "w-full rounded-[var(--field-radius)] border border-field-border bg-field px-3.5 py-2.5 text-[15px] leading-relaxed text-ink shadow-[0_0_0_1px_var(--line)] placeholder:text-ink-3",
        "focus:outline-none focus:shadow-[0_0_0_2px_var(--focus)] disabled:bg-paper-2",
        className,
      )}
      {...rest}
    />
  );
});

export function Field({ label, hint, error, children, required }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required ? <span className="ml-0.5 text-bad">*</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-[13px] text-ink-3">{hint}</span> : null}
      {error ? (
        <span className="mt-1 block text-[13px] text-bad" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" | "bad"; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "neutral" && "bg-paper-2 text-ink-2",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "bad" && "bg-bad-soft text-bad",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[0_1px_2px_oklch(0%_0_0/0.03)]", className)} {...rest}>
      {children}
    </div>
  );
}

export function Notice({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "warn" | "bad" | "ok"; className?: string }) {
  return (
    <div
      role={tone === "bad" ? "alert" : undefined}
      className={clsx(
        "rounded-[var(--field-radius)] px-4 py-3 text-sm leading-relaxed",
        tone === "neutral" && "bg-paper-2 text-ink-2",
        tone === "warn" && "bg-warn-soft text-warn-ink",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "ok" && "bg-ok-soft text-ok",
        className,
      )}
    >
      {children}
    </div>
  );
}

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return match;
}

/**
 * 모달.
 * 데스크톱: 가운데 재질 패널이 흐림+축소에서 또렷해지며 등장하고, 뒤 화면은 어두워지며 살짝 물러난다.
 * 모바일: 아래에서 올라오는 시트. 손가락에 1:1로 따라오고, 놓는 속도로 닫힐지 돌아올지 정한다.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  size,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  size?: "sm";
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const mobile = useMediaQuery("(max-width: 639px)");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);

  // 열려 있는 동안: 바탕 스크롤 잠금, Esc로 닫기, 첫 입력 요소로 초점
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.modal = "open";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>("[autofocus], input, textarea, select, button:not([aria-label='닫기'])");
      el?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.modal;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  function onSheetDragEnd(_: unknown, info: PanInfo) {
    const h = panelRef.current?.offsetHeight ?? 400;
    // 놓는 순간의 속도로 어디까지 갈지 투영한 뒤, 절반을 넘기면 닫는다
    const projected = y.get() + project(info.velocity.y);
    if (projected > h * 0.5 || info.velocity.y > 900) onClose();
  }

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/40 dark-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={clsx(
              "material-panel relative flex w-full flex-col overflow-hidden text-ink",
              "max-h-[92dvh] rounded-t-[var(--radius-panel)] sm:max-h-[90dvh] sm:rounded-[var(--radius-panel)]",
              size === "sm" ? "sm:max-w-md" : wide ? "sm:max-w-4xl" : "sm:max-w-xl",
            )}
            style={mobile ? { y } : undefined}
            initial={mobile ? { y: "100%" } : { opacity: 0, scale: 0.96, filter: "blur(8px)" }}
            animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={mobile ? { y: "100%" } : { opacity: 0, scale: 0.98, filter: "blur(6px)" }}
            transition={mobile ? springs.sheet : springs.default}
            drag={mobile ? "y" : false}
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            dragMomentum={false}
            onDragEnd={onSheetDragEnd}
          >
            {mobile ? (
              <div className="flex justify-center pt-2.5" aria-hidden>
                <span className="h-1 w-9 rounded-full bg-line-strong" />
              </div>
            ) : null}
            <div className="flex items-center justify-between px-5 py-3.5">
              <h2 id={titleId} className="text-base font-bold">
                {title}
              </h2>
              <button onClick={onClose} className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-ink-2 hover:bg-paper-3 hover:text-ink" aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <div className="scroll-edge-top min-h-0 overflow-y-auto px-5 pb-5 pt-1">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-ink-3">{icon}</div> : null}
      <p className="font-semibold text-ink">{title}</p>
      {children ? <div className="mt-1.5 max-w-md text-sm text-ink-3">{children}</div> : null}
    </div>
  );
}

export function SectionTitle({ title, desc, actions }: { title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {desc ? <p className="mt-1 max-w-[65ch] text-sm text-ink-2">{desc}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** 선택 표시가 스프링으로 미끄러지는 분할 선택 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const group = useId();
  return (
    <div role="radiogroup" className="inline-flex rounded-full bg-paper-2 p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={clsx(
              "pressable relative rounded-full font-medium disabled:cursor-not-allowed",
              size === "sm" ? "px-3 py-1 text-[13px]" : "px-4 py-1.5 text-sm",
              active ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active ? (
              <motion.span layoutId={`seg-${group}`} className="pill-thumb absolute inset-0 rounded-full" transition={springs.quick} aria-hidden />
            ) : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 보이기/숨기기를 높이 스프링으로 (고급 조건, 논의 패널 등) */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="c"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={springs.default}
          className={clsx("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export { rubberband };
export { CLUSTER_COLORS, clusterColor } from "@/lib/colors";
