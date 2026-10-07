"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

export { clsx };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};

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
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors select-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-[#2449c6] active:bg-[#1d3ba3]",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-[#f1efe9] active:bg-[#e9e6de]",
        variant === "ghost" && "text-ink-2 hover:bg-[#efede6] active:bg-[#e6e3da]",
        variant === "danger" && "border border-bad/30 bg-surface text-bad hover:bg-bad-soft",
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
        "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3",
        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-[#f1efe9]",
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
        "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[15px] leading-relaxed text-ink placeholder:text-ink-3",
        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-[#f1efe9]",
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
      {error ? <span className="mt-1 block text-[13px] text-bad">{error}</span> : null}
    </label>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" | "bad"; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "neutral" && "bg-[#efede6] text-ink-2",
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
    <div className={clsx("rounded-xl border border-line bg-surface", className)} {...rest}>
      {children}
    </div>
  );
}

export function Notice({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "warn" | "bad" | "ok"; className?: string }) {
  return (
    <div
      role={tone === "bad" ? "alert" : undefined}
      className={clsx(
        "rounded-lg px-3 py-2.5 text-sm leading-relaxed",
        tone === "neutral" && "bg-[#efede6] text-ink-2",
        tone === "warn" && "bg-warn-soft text-[#7a5212]",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "ok" && "bg-ok-soft text-ok",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={clsx(
        "m-auto max-h-[90dvh] w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/30",
        wide ? "max-w-4xl" : "max-w-xl",
      )}
    >
      {open ? (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-base font-bold">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-[#efede6] hover:text-ink" aria-label="닫기">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
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
        {desc ? <p className="mt-1 text-sm text-ink-2">{desc}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

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
  return (
    <div role="radiogroup" className="inline-flex rounded-lg bg-[#ebe9e2] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-md font-medium transition-colors disabled:cursor-not-allowed",
            size === "sm" ? "px-2.5 py-1 text-[13px]" : "px-3.5 py-1.5 text-sm",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 묶음 색 (분석 결과·보드 공통) */
export const CLUSTER_COLORS = ["#2f5bea", "#e4572e", "#1b998b", "#c77d00", "#8e44ad", "#d6336c", "#2d6a4f", "#5f6c7b", "#0081a7", "#a0522d", "#6d597a", "#3d5a80"];
export function clusterColor(i: number) {
  return CLUSTER_COLORS[((i % CLUSTER_COLORS.length) + CLUSTER_COLORS.length) % CLUSTER_COLORS.length];
}
