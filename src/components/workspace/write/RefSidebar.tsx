"use client";

import { useStorage } from "@liveblocks/react/suspense";
import type { Editor } from "@tiptap/react";
import { ChevronDown, ChevronRight, ListPlus, Quote, TextQuote } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { track } from "@/lib/client/logger";
import { citation, mediaLabel } from "@/lib/media";
import { Badge, Button, clsx, clusterColor } from "../../ui";
import { PlanSummary } from "../PlanSummary";
import type { Material } from "../types";

const TABS = [
  { key: "outline", label: "개요" },
  { key: "clusters", label: "묶음" },
  { key: "materials", label: "자료" },
  { key: "plan", label: "계획" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const ROLE = { intro: "처음", body: "가운데", conclusion: "끝" } as const;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 앞 단계에서 정리한 것을 끌어오거나 참고하는 사이드바 */
export function RefSidebar({ editor, materials, canInsert }: { editor: Editor | null; materials: Material[]; canInsert: boolean }) {
  const [tab, setTab] = useState<Tab>("outline");
  const outline = useStorage((root) => root.outline);
  const clusters = useStorage((root) => root.clusters);
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

  function insertOutline() {
    const html = (outline ?? [])
      .map((s) => `<h2>${esc(s.title)}</h2>${s.point ? `<p>${esc(s.point)}</p>` : "<p></p>"}`)
      .join("");
    insert(html, "outline_all", { sections: outline?.length ?? 0 });
  }

  function insertReferences() {
    const items = usedIds.map((id) => `<li><p>${esc(citation(byId.get(id)!))}</p></li>`).join("");
    insert(`<h2>출처</h2><ol>${items}</ol>`, "references", { count: usedIds.length });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              track("write.sidebar_tab", { tab: t.key }, { stage: "write" });
            }}
            className={clsx(
              "-mb-px flex-1 border-b-2 py-2.5 text-sm font-medium",
              tab === t.key ? "border-accent text-accent" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "outline" ? (
          <div className="space-y-2">
            {canInsert ? (
              <Button size="sm" className="w-full" onClick={insertOutline}>
                <ListPlus size={15} /> 개요 뼈대를 글에 넣기
              </Button>
            ) : null}
            {(outline ?? []).map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", s.title)}
                className="rounded-lg border border-line bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    <span className="mr-1.5 text-xs font-semibold text-ink-3">{ROLE[s.role]}</span>
                    {s.title}
                  </p>
                  {canInsert ? (
                    <button
                      onClick={() => insert(`<h2>${esc(s.title)}</h2><p></p>`, "outline_heading", { sectionId: s.id })}
                      className="text-xs text-accent hover:underline"
                    >
                      제목 넣기
                    </button>
                  ) : null}
                </div>
                {s.point ? <p className="mt-1 text-[13px] text-ink-2">{s.point}</p> : null}
                {s.materialIds.length ? (
                  <ul className="mt-2 space-y-1">
                    {s.materialIds.map((id) => {
                      const m = byId.get(id);
                      return m ? <MaterialItem key={id} m={m} onInsert={canInsert ? insert : undefined} /> : null;
                    })}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {tab === "clusters" ? (
          <div className="space-y-2">
            {(clusters ?? []).map((c, i) => (
              <div key={c.id} className="rounded-lg border border-line bg-surface p-3" style={{ borderLeft: `4px solid ${clusterColor(i)}` }}>
                <p className="text-sm font-bold">
                  {i + 1}. {c.name || "이름 없는 묶음"}
                </p>
                {c.note ? <p className="mt-0.5 text-[13px] text-ink-2">{c.note}</p> : null}
                <ul className="mt-2 space-y-1">
                  {c.materialIds.map((id) => {
                    const m = byId.get(id);
                    const d = decisions?.[id];
                    if (!m) return null;
                    return (
                      <li key={id}>
                        <MaterialItem m={m} onInsert={canInsert ? insert : undefined} status={d?.status} reason={d?.reason} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!clusters?.length ? <p className="py-6 text-center text-[13px] text-ink-3">내용 생성하기에서 만든 묶음이 여기에 보여요.</p> : null}
          </div>
        ) : null}

        {tab === "materials" ? (
          <div className="space-y-2">
            {canInsert && usedIds.length ? (
              <Button size="sm" className="w-full" onClick={insertReferences}>
                <ListPlus size={15} /> 출처 목록 넣기 ({usedIds.length}개)
              </Button>
            ) : null}
            <ul className="space-y-1">
              {materials.map((m) => (
                <li key={m.id}>
                  <MaterialItem m={m} onInsert={canInsert ? insert : undefined} status={decisions?.[m.id]?.status} reason={decisions?.[m.id]?.reason} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "plan" ? <PlanSummary compact /> : null}
      </div>
    </div>
  );
}

const STATUS = {
  selected: { label: "선정", tone: "ok" },
  hold: { label: "보류", tone: "warn" },
  excluded: { label: "제외", tone: "bad" },
} as const;

function MaterialItem({
  m,
  onInsert,
  status,
  reason,
}: {
  m: Material;
  onInsert?: (html: string, what: string, payload?: Record<string, unknown>) => void;
  status?: string;
  reason?: string;
}) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const st = status && status in STATUS ? STATUS[status as keyof typeof STATUS] : null;
  const cite = `(${[m.source, `「${m.title}」`].filter(Boolean).join(", ")})`;

  function quoteSelection() {
    const sel = window.getSelection();
    const text = sel && bodyRef.current?.contains(sel.anchorNode) ? sel.toString().trim() : "";
    if (!text) {
      alert("아래 자료 내용에서 넣고 싶은 부분을 먼저 드래그해서 골라 주세요.");
      return;
    }
    onInsert?.(`<blockquote><p>${esc(text)}</p></blockquote><p>${esc(cite)}</p>`, "quote", { materialId: m.id, chars: text.length });
  }

  return (
    <div className={clsx("rounded-lg border text-sm", open ? "border-line-strong bg-surface" : "border-transparent")}>
      <div className="flex items-center gap-1.5 px-1.5 py-1">
        <button onClick={() => setOpen((v) => !v)} className="text-ink-3" aria-expanded={open} aria-label="펼치기">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/plain", cite)}
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 truncate text-left hover:text-accent"
          title={m.title}
        >
          {m.title}
        </button>
        {st ? <Badge tone={st.tone}>{st.label}</Badge> : null}
      </div>
      {open ? (
        <div className="space-y-2 px-2.5 pb-2.5">
          <p className="text-xs text-ink-3">
            {m.isOnline ? "온라인" : "오프라인"} {mediaLabel(m.mediaType)}
            {m.source ? `, ${m.source}` : ""}
          </p>
          {reason ? <p className="text-xs text-ink-2">근거: {reason}</p> : null}
          <div ref={bodyRef} className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-[13px] leading-relaxed text-ink-2">
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
