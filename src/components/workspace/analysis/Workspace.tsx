"use client";

import { ChevronDown, ChevronUp, Maximize2, Minimize2, X, type LucideIcon } from "lucide-react";
import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Spinner, clsx } from "../../ui";

/*
 * CODAP처럼 한 화면을 작업대로 쓰는 틀.
 * - 위: 메뉴 막대, 왼쪽: 도구 막대, 가운데: 창을 띄우는 작업 공간
 * - 창 배치(위치·크기·순서·접힘·최대화)는 학생마다 따로, 이 브라우저에 저장한다.
 *   분석 조건과 결과는 Liveblocks와 서버로 모둠이 함께 쓴다(이 파일은 배치만 다룬다).
 */

export type Win = { x: number; y: number; w: number; h: number; collapsed?: boolean };
export type Layout<K extends string> = { wins: Partial<Record<K, Win>>; order: K[]; max: K | null };

const GAP = 12;
const MIN_W = 260;
const MIN_H = 140;
const TITLE_H = 40;
/** 이보다 좁으면 창을 띄우지 않고 한 번에 한 창씩 꽉 채워 보여 준다 */
export const NARROW = 860;

function readLayout<K extends string>(key: string): Layout<K> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Layout<K>;
    return v && typeof v === "object" && v.wins && Array.isArray(v.order) ? v : null;
  } catch {
    return null;
  }
}

/**
 * 창 배치 상태. presetFor(name, w, h)는 기본 배치를, homeOf(tool, w, h)는 한 창을 처음 열 때의 자리를 준다.
 * 저장된 배치가 없으면 작업 공간 크기를 안 순간 initialPreset으로 시작한다.
 */
export function useLayout<K extends string, P extends string>({
  storageKey,
  initialPreset,
  presetFor,
  homeOf,
}: {
  storageKey: string;
  initialPreset: P;
  presetFor: (name: P, w: number, h: number) => Layout<K>;
  homeOf: (tool: K, w: number, h: number, openCount: number) => Win;
}) {
  const [layout, setLayout] = useState<Layout<K> | null>(() => readLayout<K>(storageKey));
  const [size, setSize] = useState({ w: 0, h: 0 });
  const init = useRef({ initialPreset, presetFor });
  const sizeRef = useRef(size);
  const homeRef = useRef(homeOf);
  useEffect(() => {
    init.current = { initialPreset, presetFor };
    homeRef.current = homeOf;
  });

  // 작업 공간 크기를 재고, 처음이면 기본 배치로 시작
  const canvasRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      sizeRef.current = { w, h };
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
      if (w > 0 && h > 0) setLayout((l) => l ?? init.current.presetFor(init.current.initialPreset, w, h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!layout) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      /* 개인 브라우저 저장이 막혀 있어도 작업은 계속된다 */
    }
  }, [layout, storageKey]);

  const update = useCallback((fn: (l: Layout<K>) => Layout<K>) => setLayout((l) => (l ? fn(l) : l)), []);
  const front = (order: K[], t: K) => [...order.filter((x) => x !== t), t];

  const api = {
    open: (t: K) =>
      update((l) => {
        const cur = l.wins[t];
        const { w, h } = sizeRef.current;
        const win = cur ? { ...cur, collapsed: false } : homeRef.current(t, w, h, l.order.length);
        return { ...l, wins: { ...l.wins, [t]: win }, order: front(l.order, t), max: l.max ? t : null };
      }),
    ensureOpen: (tools: K[]) =>
      update((l) => {
        const { w, h } = sizeRef.current;
        const wins = { ...l.wins };
        let order = l.order;
        tools.forEach((t, i) => {
          wins[t] = wins[t] ? { ...wins[t]!, collapsed: false } : homeRef.current(t, w, h, l.order.length + i);
          order = front(order, t);
        });
        return { ...l, wins, order };
      }),
    close: (t: K) =>
      update((l) => {
        const wins = { ...l.wins };
        delete wins[t];
        const order = l.order.filter((x) => x !== t);
        return { wins, order, max: l.max === t ? (order[order.length - 1] ?? null) : l.max };
      }),
    focus: (t: K) => update((l) => (l.order[l.order.length - 1] === t ? l : { ...l, order: front(l.order, t), max: l.max ? t : null })),
    place: (t: K, patch: Partial<Win>) => update((l) => (l.wins[t] ? { ...l, wins: { ...l.wins, [t]: { ...l.wins[t]!, ...patch } } } : l)),
    toggleCollapse: (t: K) => update((l) => (l.wins[t] ? { ...l, wins: { ...l.wins, [t]: { ...l.wins[t]!, collapsed: !l.wins[t]!.collapsed } } } : l)),
    toggleMax: (t: K) => update((l) => ({ ...l, max: l.max ? null : t, order: front(l.order, t) })),
    preset: (name: P) => setLayout(() => init.current.presetFor(name, sizeRef.current.w || 1200, sizeRef.current.h || 700)),
    closeAll: () => update(() => ({ wins: {}, order: [], max: null })),
  };

  return { layout, size, canvasRef, ...api };
}

/** 작업 공간에 뜨는 창 하나. 제목 막대로 옮기고 오른쪽 아래 모서리로 크기를 바꾼다. */
export function WindowFrame({
  title,
  icon: Icon,
  win,
  z,
  top,
  maximized,
  hidden,
  bounds,
  onFocus,
  onPlace,
  onClose,
  onCollapse,
  onMax,
  bodyClassName,
  children,
}: {
  title: string;
  icon: LucideIcon;
  win: Win;
  z: number;
  top: boolean;
  maximized: boolean;
  hidden?: boolean;
  bounds: { w: number; h: number };
  onFocus: () => void;
  onPlace: (patch: Partial<Win>) => void;
  onClose: () => void;
  onCollapse: () => void;
  onMax: () => void;
  bodyClassName?: string;
  children: ReactNode;
}) {
  // 끄는 동안의 이동·크기 변화는 이 창 안에서만 그리고, 놓을 때 한 번 저장한다(다른 창은 다시 그리지 않음)
  const [drag, setDrag] = useState<{ dx: number; dy: number; dw: number; dh: number } | null>(null);
  const start = useRef<{ x: number; y: number; mode: "move" | "size" } | null>(null);
  const headingId = useId();

  function begin(e: React.PointerEvent, mode: "move" | "size") {
    if (maximized || e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, mode };
    setDrag({ dx: 0, dy: 0, dw: 0, dh: 0 });
  }
  function moveTo(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    setDrag(s.mode === "move" ? { dx, dy, dw: 0, dh: 0 } : { dx: 0, dy: 0, dw: dx, dh: dy });
  }
  function end() {
    const s = start.current;
    start.current = null;
    if (!s || !drag) return setDrag(null);
    if (s.mode === "move") {
      const x = Math.max(0, Math.min(Math.max(0, bounds.w - 80), win.x + drag.dx));
      const y = Math.max(0, win.y + drag.dy);
      onPlace({ x: Math.round(x), y: Math.round(y) });
    } else {
      onPlace({ w: Math.round(Math.max(MIN_W, win.w + drag.dw)), h: Math.round(Math.max(MIN_H, win.h + drag.dh)) });
    }
    setDrag(null);
  }

  const style: React.CSSProperties = maximized
    ? { left: 8, top: 8, right: 8, bottom: 8, zIndex: z }
    : {
        left: win.x,
        top: win.y,
        width: Math.max(MIN_W, win.w + (drag?.dw ?? 0)),
        height: win.collapsed ? TITLE_H : Math.max(MIN_H, win.h + (drag?.dh ?? 0)),
        transform: drag && (drag.dx || drag.dy) ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
        zIndex: drag ? 999 : z,
      };

  return (
    <section
      aria-labelledby={headingId}
      onPointerDownCapture={top ? undefined : onFocus}
      className={clsx(
        "absolute flex flex-col overflow-hidden rounded-2xl bg-surface",
        top || drag ? "shadow-[0_0_0_1px_var(--line-strong),0_22px_50px_-22px_rgb(0_0_0/0.4)]" : "shadow-[0_0_0_1px_var(--line),0_10px_30px_-20px_rgb(0_0_0/0.3)]",
        hidden && "hidden",
      )}
      style={style}
    >
      <header
        onPointerDown={(e) => begin(e, "move")}
        onPointerMove={moveTo}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={onMax}
        className={clsx("flex shrink-0 select-none items-center gap-2 border-b border-line pl-3 pr-1.5", !maximized && "cursor-grab active:cursor-grabbing", top ? "bg-surface" : "bg-paper-2/50")}
        style={{ height: TITLE_H }}
      >
        <Icon size={15} className={top ? "text-accent" : "text-ink-3"} aria-hidden />
        <h2 id={headingId} className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {title}
        </h2>
        <WinButton label={win.collapsed ? "창 펴기" : "창 접기"} onClick={onCollapse} hidden={maximized}>
          {win.collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </WinButton>
        <WinButton label={maximized ? "창 원래대로" : "창 크게"} onClick={onMax}>
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </WinButton>
        <WinButton label="창 닫기" onClick={onClose}>
          <X size={15} />
        </WinButton>
      </header>
      {!win.collapsed || maximized ? (
        <div className={clsx("min-h-0 flex-1 overflow-auto", bodyClassName ?? "p-4")}>
          {/* 창 안의 데이터가 처음 불러와지는 동안 화면 전체가 아니라 이 창만 기다린다 */}
          <Suspense
            fallback={
              <div className="flex items-center gap-2 py-6 text-sm text-ink-3">
                <Spinner /> 불러오는 중…
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      ) : null}
      {!maximized && !win.collapsed ? (
        <span
          onPointerDown={(e) => begin(e, "size")}
          onPointerMove={moveTo}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
          style={{ background: "linear-gradient(135deg, transparent 50%, var(--line-strong) 50% 58%, transparent 58% 70%, var(--line-strong) 70% 78%, transparent 78%)" }}
          aria-hidden
        />
      ) : null}
    </section>
  );
}

function WinButton({ label, onClick, hidden, children }: { label: string; onClick: () => void; hidden?: boolean; children: ReactNode }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="pressable flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-paper-2 hover:text-ink"
    >
      {children}
    </button>
  );
}

/** 작업 공간: 점 격자 바탕. 창이 가장자리를 넘으면 스크롤된다. */
export function Canvas({ canvasRef, extent, children }: { canvasRef: React.RefObject<HTMLDivElement | null>; extent: { w: number; h: number }; children: ReactNode }) {
  return (
    <div
      ref={canvasRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-paper"
      style={{ backgroundImage: "radial-gradient(var(--line-strong) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
    >
      <div aria-hidden style={{ width: extent.w, height: extent.h }} />
      {children}
    </div>
  );
}

export function extentOf(wins: Partial<Record<string, Win>>) {
  let w = 0;
  let h = 0;
  Object.values(wins).forEach((v) => {
    if (!v) return;
    w = Math.max(w, v.x + v.w + GAP);
    h = Math.max(h, v.y + (v.collapsed ? TITLE_H : v.h) + GAP);
  });
  return { w, h };
}

/** 왼쪽 도구 막대: 단계 번호별로 묶은 아이콘. 누르면 그 창을 열거나 맨 앞으로 가져온다. */
export function ToolPalette<K extends string>({
  groups,
  openTools,
  topTool,
  onPick,
}: {
  groups: { step: number; label: string; tools: { key: K; label: string; icon: LucideIcon }[] }[];
  openTools: Set<K>;
  topTool: K | null;
  onPick: (k: K) => void;
}) {
  return (
    <nav aria-label="분석 도구" className="flex w-[84px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-panel px-2 py-3">
      {groups.map((g, gi) => (
        <div key={g.step} className={clsx("flex flex-col gap-1", gi > 0 && "mt-1 border-t border-line pt-2")}>
          <p className="flex items-center justify-center gap-1 text-[10.5px] font-semibold text-ink-3" title={g.label}>
            <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-ink/55 text-[9.5px] text-surface">{g.step}</span>
            <span className="truncate">{g.label}</span>
          </p>
          {g.tools.map((t) => {
            const open = openTools.has(t.key);
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onPick(t.key)}
                aria-label={t.label}
                aria-pressed={open}
                title={t.label}
                className={clsx(
                  "pressable relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10.5px] leading-[1.2]",
                  topTool === t.key ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--line)]" : open ? "text-ink hover:bg-paper-2" : "text-ink-3 hover:bg-paper-2 hover:text-ink-2",
                )}
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden />
                <span className="line-clamp-2 w-full break-keep text-center">{t.label}</span>
                {open ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** 메뉴 막대의 내림 메뉴 */
export function MenuButton({ label, items }: { label: string; items: ({ label: string; onSelect: () => void; disabled?: boolean } | "sep")[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
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
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx("pressable flex h-8 items-center gap-0.5 rounded-lg px-2.5 text-[13px] font-medium", open ? "bg-paper-2 text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink")}
      >
        {label} <ChevronDown size={13} className="text-ink-3" />
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 top-9 z-[1000] min-w-52 rounded-xl bg-surface p-1 shadow-[0_0_0_1px_var(--line),0_18px_40px_-16px_rgb(0_0_0/0.35)]">
          {items.map((it, i) =>
            it === "sep" ? (
              <div key={i} className="my-1 border-t border-line" />
            ) : (
              <button
                key={it.label}
                role="menuitem"
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-paper-2 disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

export const LAYOUT_GAP = GAP;
