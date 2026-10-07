"use client";

import { useStorage } from "@liveblocks/react/suspense";
import type { Editor } from "@tiptap/react";
import { BookOpen, ChevronDown, ChevronRight, ListPlus, ListTree, PanelLeftClose, Quote, Target, TextQuote } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { track } from "@/lib/client/logger";
import { citation, mediaLabel } from "@/lib/media";
import { useToast } from "../../toast";
import { Button, clsx } from "../../ui";
import { PlanSummary } from "../PlanSummary";
import type { Material } from "../types";

type Tab = "outline" | "materials" | "plan";
const ROLE = { intro: "처음", body: "가운데", conclusion: "끝" } as const;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * 글을 쓸 때 옆에 두는 참고 목록.
 * 위: 폴더 목록(개요·자료·계획), 아래: 고른 목록의 내용이 한 가지 모양의 행으로.
 */
export function RefSidebar({ editor, materials, canInsert, onCollapse }: { editor: Editor | null; materials: Material[]; canInsert: boolean; onCollapse?: () => void }) {
  const [tab, setTab] = useState<Tab>("outline");
  const outline = useStorage((root) => root.outline);
  const decisions = useStorage((root) => root.decisions);
  const byId = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  function insert(html: string, what: string, payload: Record<string, unknown> = {}) {
    if (!editor || !canInsert) return;
    editor.chain().focus().insertContent(html).run();
    track("write.insert_from_sidebar", { what, ...payload }, { stage: "write" });
  }

  const usedIds = useMemo(() => {
    const placed = (outline ?? []).flatMap((s) => s.materialIds);
    const selected = materials.filter((m) => decisions?.[m.id]?.status === "selected").map((m) => m.id);
    return [...new Set([...placed, ...selected])].filter((id) => byId.has(id));
  }, [outline, decisions, materials, byId]);

  const NAV: { key: Tab; label: string; icon: typeof ListTree; count?: number }[] = [
    { key: "outline", label: "개요", icon: ListTree, count: outline?.length ?? 0 },
    { key: "materials", label: "자료", icon: BookOpen, count: materials.length },
    { key: "plan", label: "계획", icon: Target },
  ];

  const insertOutline = () =>
    insert((outline ?? []).map((s) => `<h2>${esc(s.title)}</h2>${s.point ? `<p>${esc(s.point)}</p>` : "<p></p>"}`).join(""), "outline_all", { sections: outline?.length ?? 0 });
  const insertReferences = () =>
    insert(`<h2>출처</h2><ol>${usedIds.map((id) => `<li><p>${esc(citation(byId.get(id)!))}</p></li>`).join("")}</ol>`, "references", { count: usedIds.length });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <p className="text-[13px] font-semibold text-ink-3">참고</p>
        {onCollapse ? (
          <button onClick={onCollapse} className="pressable flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-paper-2 hover:text-ink" aria-label="사이드바 닫기">
            <PanelLeftClose size={16} />
          </button>
        ) : null}
      </div>
      <nav className="px-2" role="tablist" aria-label="참고 목록">
        {NAV.map((n) => {
          const on = tab === n.key;
          const Icon = n.icon;
          return (
            <button
              key={n.key}
              role="tab"
              aria-selected={on}
              aria-label={n.label}
              onClick={() => {
                setTab(n.key);
                track("write.sidebar_tab", { tab: n.key }, { stage: "write" });
              }}
              className={clsx("pressable flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[15px]", on ? "bg-paper-2 font-semibold text-ink" : "text-ink-2 hover:bg-paper-2/60 hover:text-ink")}
            >
              <Icon size={18} strokeWidth={1.8} className={on ? "text-ink" : "text-ink-3"} />
              <span className="flex-1 text-left">{n.label}</span>
              {n.count !== undefined ? <span className="rounded-full bg-paper-3/70 px-2 py-0.5 text-xs tabular-nums text-ink-2">{n.count}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="mx-4 my-3 border-t border-line" />

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {tab === "outline" ? (
          <div className="space-y-4">
            {canInsert ? (
              <Button size="sm" className="mx-2 w-[calc(100%-1rem)]" onClick={insertOutline}>
                <ListPlus size={15} /> 개요 뼈대를 글에 넣기
              </Button>
            ) : null}
            {(outline ?? []).map((s) => (
              <div key={s.id}>
                <Row
                  title={s.title}
                  meta={ROLE[s.role]}
                  bold
                  action={canInsert ? { label: "제목 넣기", onClick: () => insert(`<h2>${esc(s.title)}</h2><p></p>`, "outline_heading", { sectionId: s.id }) } : undefined}
                />
                {s.point ? <p className="px-3 pb-1 text-[13px] leading-snug text-ink-3">{s.point}</p> : null}
                {s.materialIds.map((id) => {
                  const m = byId.get(id);
                  return m ? <MaterialItem key={id} m={m} onInsert={canInsert ? insert : undefined} indent /> : null;
                })}
              </div>
            ))}
          </div>
        ) : null}

        {tab === "materials" ? (
          <div className="space-y-1">
            {canInsert && usedIds.length ? (
              <Button size="sm" className="mx-2 mb-3 w-[calc(100%-1rem)]" onClick={insertReferences}>
                <ListPlus size={15} /> 출처 목록 넣기 ({usedIds.length}개)
              </Button>
            ) : null}
            {materials.map((m) => (
              <MaterialItem key={m.id} m={m} onInsert={canInsert ? insert : undefined} status={decisions?.[m.id]?.status} reason={decisions?.[m.id]?.reason} />
            ))}
          </div>
        ) : null}

        {tab === "plan" ? (
          <div className="px-2">
            <PlanSummary compact />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 한 가지 모양의 행: (색 점) 제목 … [넣기] */
function Row({ title, meta, dot, bold, action }: { title: string; meta?: string; dot?: string; bold?: boolean; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
      {dot ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} /> : null}
      {meta ? <span className="shrink-0 text-xs text-ink-3">{meta}</span> : null}
      <span className={clsx("min-w-0 flex-1 truncate", bold && "font-semibold")}>{title}</span>
      {action ? (
        <button onClick={action.onClick} className="pressable shrink-0 rounded-full bg-paper-2 px-2.5 py-0.5 text-xs font-medium text-ink-2 opacity-0 hover:bg-paper-3 focus:opacity-100 group-hover:opacity-100">
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

const STATUS = {
  selected: { label: "선정", cls: "text-ok" },
  hold: { label: "보류", cls: "text-warn" },
  excluded: { label: "제외", cls: "text-bad" },
} as const;

function MaterialItem({
  m,
  onInsert,
  status,
  reason,
  indent,
}: {
  m: Material;
  onInsert?: (html: string, what: string, payload?: Record<string, unknown>) => void;
  status?: string;
  reason?: string;
  indent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const st = status && status in STATUS ? STATUS[status as keyof typeof STATUS] : null;
  const cite = `(${[m.source, `「${m.title}」`].filter(Boolean).join(", ")})`;

  function quoteSelection() {
    const sel = window.getSelection();
    const text = sel && bodyRef.current?.contains(sel.anchorNode) ? sel.toString().trim() : "";
    if (!text) {
      toast({ message: "자료 내용에서 넣고 싶은 부분을 먼저 드래그해서 골라 주세요.", tone: "bad" });
      return;
    }
    onInsert?.(`<blockquote><p>${esc(text)}</p></blockquote><p>${esc(cite)}</p>`, "quote", { materialId: m.id, chars: text.length });
  }

  return (
    <div className={clsx("rounded-xl text-sm", open && "bg-surface shadow-[var(--card-shadow)]", indent && "ml-3")}>
      <div className="group flex items-center gap-2 px-3 py-1.5">
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 text-ink-3" aria-expanded={open} aria-label="펼치기">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 truncate text-left hover:text-accent" title={m.title}>
          {m.title}
        </button>
        {st ? <span className={clsx("shrink-0 text-[11px] font-medium", st.cls)}>{st.label}</span> : null}
        {onInsert ? (
          <button onClick={() => onInsert(`${esc(cite)} `, "citation", { materialId: m.id })} className="pressable shrink-0 rounded-full bg-paper-2 px-2.5 py-0.5 text-xs font-medium text-ink-2 opacity-0 hover:bg-paper-3 focus:opacity-100 group-hover:opacity-100" title="출처 표시를 글에 넣기">
            넣기
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-2 px-3 pb-3">
          <p className="text-xs text-ink-3">
            {m.isOnline ? "온라인" : "오프라인"} {mediaLabel(m.mediaType)}
            {m.source ? `, ${m.source}` : ""}
          </p>
          {reason ? <p className="text-xs text-ink-2">근거: {reason}</p> : null}
          <div ref={bodyRef} className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper-2/60 p-2.5 text-[13px] leading-relaxed text-ink-2">
            {m.content}
          </div>
          {onInsert ? (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={quoteSelection} title="위 내용에서 고른 부분을 인용으로 넣어요">
                <Quote size={13} /> 고른 부분 인용
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onInsert(`${esc(cite)} `, "citation", { materialId: m.id })}>
                <TextQuote size={13} /> 출처 표시
              </Button>
            </div>
          ) : null}
          {m.url ? (
            <a href={m.url} target="_blank" rel="noreferrer noopener" className="block truncate text-xs text-accent hover:underline">
              {m.url}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
