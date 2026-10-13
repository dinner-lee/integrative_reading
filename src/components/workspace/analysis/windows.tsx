"use client";

import { useStorage } from "@liveblocks/react/suspense";
import { ArrowRight, FileText, GitCompare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { METHODS } from "@/lib/stages";
import type { Decision } from "../../../../liveblocks.config";
import { Badge, Button, Card, Empty, Input, Notice, Segmented, Spinner, Textarea, clsx, clusterColor } from "../../ui";
import { updateRunCache } from "../hooks";
import { DECISIONS, useSetDecision } from "../stages/GenerateStage";
import type { Material, Morpheme, PreprocessStats as Stats, Removed, RunFull, RunSummary } from "../types";
import { POS_OPTIONS, PosPicker, WinHeading, type Conditions } from "./Conditions";
import { MorphemeStrip, RemovedLists, Warnings, type Sel } from "./ResultView";

const methodShort = (m: string) => METHODS.find((x) => x.key === m)?.short ?? m;

export function describeParams(r: Pick<RunSummary, "method" | "params" | "materialIds">) {
  const p = r.params;
  return [
    methodShort(r.method),
    p.mining.k ? `${r.method === "lda" ? "주제" : "묶음"} ${p.mining.k}` : "묶음 자동",
    POS_OPTIONS.find((o) => o.value === p.preprocess.pos)?.label,
    `불용어 ${p.preprocess.stopwords.length}`,
    p.mining.minDf > 1 ? `최소 ${p.mining.minDf}자료` : null,
    p.mining.ngram === 2 ? "두 낱말" : null,
    `자료 ${r.materialIds.length}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** 결과가 없을 때 결과 창들이 같이 보여 주는 안내 */
export function NoRun({ loading, canEdit }: { loading: boolean; canEdit: boolean }) {
  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-ink-3">
        <Spinner /> 결과를 불러오는 중…
      </div>
    );
  return <Empty title="아직 분석한 적이 없어요">{canEdit ? "위 막대의 ▶ 분석하기를 눌러요." : "모둠이 아직 분석하지 않았어요."}</Empty>;
}

type Filter = "all" | Decision;

/**
 * 자료 표: 자료마다 한 줄. 분석에 넣을지(공유 조건), 들어간 묶음, 선정·보류·제외와 근거.
 * 행을 누르면 다른 창에서도 같은 자료가 강조된다.
 */
export function MaterialTable({
  materials,
  cond,
  setCond,
  canEdit,
  run,
  onOpen,
  selected,
  onSelect,
}: {
  materials: Material[];
  cond: Conditions;
  setCond: (c: Conditions) => void;
  canEdit: boolean;
  run: RunFull | null;
  onOpen: (m: Material) => void;
} & Sel) {
  const clusters = useStorage((root) => root.clusters ?? null);
  const decisions = useStorage((root) => root.decisions ?? null);
  const setDecision = useSetDecision();
  const [filter, setFilter] = useState<Filter>("all");
  const chosen = new Set(cond.materialIds);

  // 이름 붙인 묶음(채택 뒤)이 있으면 그것을, 없으면 지금 보는 분석 결과의 묶음을 보여 준다
  const adopted = useMemo(() => {
    const m = new Map<string, { label: string; color: string }>();
    (clusters ?? []).forEach((c, i) => c.materialIds.forEach((id) => m.set(id, { label: c.name || `묶음 ${i + 1}`, color: clusterColor(i) })));
    return m;
  }, [clusters]);
  const fromRun = useMemo(() => new Map((run?.result.docs ?? []).map((d) => [d.id, d.cluster])), [run]);
  const statusOf = (id: string) => (decisions?.[id]?.status ?? "undecided") as Decision;

  const counts: Record<Filter, number> = { all: materials.length, undecided: 0, selected: 0, hold: 0, excluded: 0 };
  materials.forEach((m) => counts[statusOf(m.id)]++);
  const rows = filter === "all" ? materials : materials.filter((m) => statusOf(m.id) === filter);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `전체 ${counts.all}` },
            { value: "undecided", label: `아직 ${counts.undecided}` },
            { value: "selected", label: `선정 ${counts.selected}` },
            { value: "hold", label: `보류 ${counts.hold}` },
            { value: "excluded", label: `제외 ${counts.excluded}` },
          ]}
        />
        <span className="ml-auto text-[12.5px] text-ink-3">
          분석에 넣은 자료 {cond.materialIds.length}/{materials.length}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="bg-surface-2 text-left text-[12px] text-ink-3">
            <tr>
              <th className="w-10 px-2 py-2 text-center font-medium" title="분석에 넣기">
                <input
                  type="checkbox"
                  aria-label="모든 자료를 분석에 넣기"
                  className="accent-[var(--accent)]"
                  disabled={!canEdit}
                  checked={chosen.size === materials.length}
                  onChange={(e) => setCond({ ...cond, materialIds: e.target.checked ? materials.map((m) => m.id) : [] })}
                />
              </th>
              <th className="px-2 py-2 font-medium">자료</th>
              <th className="px-2 py-2 font-medium">묶음</th>
              <th className="px-2 py-2 font-medium">판단</th>
              <th className="px-2 py-2 font-medium">근거</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const st = statusOf(m.id);
              const reason = decisions?.[m.id]?.reason ?? "";
              const a = adopted.get(m.id);
              const rc = fromRun.get(m.id);
              const isSel = selected === m.id;
              return (
                <tr
                  key={m.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("input,button,label")) return;
                    onSelect?.(m.id);
                  }}
                  aria-selected={isSel}
                  className={clsx("cursor-default border-t border-line align-middle", isSel ? "bg-accent-soft/50" : "hover:bg-paper-2/50", !chosen.has(m.id) && "text-ink-3")}
                >
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${m.title} 분석에 넣기`}
                      className="accent-[var(--accent)]"
                      disabled={!canEdit}
                      checked={chosen.has(m.id)}
                      onChange={(e) => setCond({ ...cond, materialIds: e.target.checked ? [...cond.materialIds, m.id] : cond.materialIds.filter((x) => x !== m.id) })}
                    />
                  </td>
                  <td className="max-w-[15rem] px-2 py-1.5">
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => onSelect?.(m.id)} onDoubleClick={() => onOpen(m)} className={clsx("min-w-0 truncate text-left font-medium hover:text-accent", st === "excluded" && "line-through")}>
                        {m.title}
                      </button>
                      <button type="button" onClick={() => onOpen(m)} aria-label={`${m.title} 원문 보기`} title="원문 보기" className="shrink-0 rounded p-0.5 text-ink-3 hover:bg-paper-2 hover:text-ink">
                        <FileText size={13} />
                      </button>
                    </span>
                    <span className="block text-[11.5px] text-ink-3">{m.content.length.toLocaleString()}자</span>
                  </td>
                  <td className="px-2 py-1.5">
                    {a ? (
                      <span className="inline-flex max-w-[9rem] items-center gap-1.5 truncate">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                        {a.label}
                      </span>
                    ) : rc !== undefined ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: clusterColor(rc) }} />
                        결과 {rc + 1}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1" role="radiogroup" aria-label={`${m.title} 판단`}>
                      {DECISIONS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          role="radio"
                          aria-checked={st === d.value}
                          disabled={!canEdit}
                          onClick={() => setDecision(m.id, { status: st === d.value ? "undecided" : d.value })}
                          className={clsx(
                            "pressable h-6 rounded-full px-2 text-[12px] font-medium disabled:cursor-default",
                            st === d.value ? (d.tone === "ok" ? "bg-ok text-on-accent" : d.tone === "warn" ? "bg-warn text-on-accent" : "bg-bad text-on-accent") : "bg-paper-2 text-ink-2 hover:bg-paper-3",
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="min-w-[12rem] px-2 py-1.5">
                    {st === "undecided" ? (
                      <span className="text-ink-3">—</span>
                    ) : canEdit ? (
                      <Input
                        value={reason}
                        onChange={(e) => setDecision(m.id, { reason: e.target.value })}
                        placeholder={`근거: ${DECISIONS.find((d) => d.value === st)?.prompt}`}
                        maxLength={500}
                        className="h-8 text-[13px]"
                      />
                    ) : (
                      <span className="text-ink-2">{reason || "아직 없음"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-3">
                  해당하는 자료가 없어요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 형태소·전처리: 고른 자료가 지금 조건(품사·불용어)으로 어떻게 낱말로 바뀌는지 바로 본다 */
export function PreprocessWindow({ cond, setCond, materials, canEdit, selected, onSelect }: { cond: Conditions; setCond: (c: Conditions) => void; materials: Material[]; canEdit: boolean } & Sel) {
  const usable = useMemo(() => materials.filter((m) => cond.materialIds.includes(m.id)), [materials, cond.materialIds]);
  const [local, setLocal] = useState<string | null>(null);
  const current = selected && usable.some((m) => m.id === selected) ? selected : usable.some((m) => m.id === local) ? local : (usable[0]?.id ?? null);
  const [data, setData] = useState<{ stats: Stats; removed: Removed; morphemes: Morpheme[]; tokens: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify([current, cond.preprocess]);

  useEffect(() => {
    if (!current) return;
    let alive = true;
    const t = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api<typeof data>("/api/preprocess", { method: "POST", json: { materialId: current, preprocess: cond.preprocess } })
        .then((d) => alive && setData(d))
        .catch((e) => alive && setError((e as Error).message))
        .finally(() => alive && setLoading(false));
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="space-y-4">
      <fieldset disabled={!canEdit}>
        <PosPicker value={cond} onChange={setCond} />
      </fieldset>
      <div className="border-t border-line pt-4">
        <WinHeading title="미리볼 자료" desc="다른 창에서 자료를 고르면 여기도 따라 바뀌어요." />
        {usable.length ? (
          <select
            value={current ?? ""}
            onChange={(e) => (onSelect ? onSelect(e.target.value) : setLocal(e.target.value))}
            className="select-pill h-9 w-full rounded-full bg-paper-2 pl-4 text-[13px] font-medium"
            aria-label="미리볼 자료"
          >
            {usable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        ) : (
          <Empty title="분석에 넣은 자료가 없어요" />
        )}
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {current ? (
        data ? (
          <div className={clsx("space-y-4 transition-opacity", loading && "opacity-60")}>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["원문 글자", data.stats.chars],
                  ["형태소", data.stats.morphemes],
                  ["분석에 쓴 낱말", data.stats.kept],
                ] as const
              ).map(([l, v], i) => (
                <div key={l} className={clsx("rounded-xl px-3 py-2", i === 2 ? "bg-accent-soft text-accent" : "bg-paper-2")}>
                  <p className="text-[11px] text-ink-3">{l}</p>
                  <p className="text-lg font-semibold tabular-nums">{v.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold">형태소 (파란 낱말만 분석에 쓰여요)</p>
              <MorphemeStrip morphemes={data.morphemes} />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold">빠진 낱말</p>
              <RemovedLists removed={data.removed} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-6 text-sm text-ink-3">
            <Spinner /> 형태소 분석 중…
          </div>
        )
      ) : null}
    </div>
  );
}

/** 결과 요약: 지금 보는 분석의 조건과 지표 */
export function SummaryWindow({ run, adoptedId }: { run: RunFull; adoptedId: string | null }) {
  const r = run.result;
  const m = r.metrics;
  const tiles: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "neutral" }[] = [
    { label: "분석한 자료", value: `${r.docs.length}개`, sub: `${r.preprocessing.reduce((a, p) => a + p.stats.kept, 0).toLocaleString()} 낱말` },
    { label: "남은 낱말 종류", value: `${r.vocabSize}개`, sub: "불용어·품사로 거른 뒤" },
    { label: r.method === "lda" ? "주제 수" : "묶음 수", value: `${r.k}개`, sub: run.params.mining.k ? "직접 정함" : "자동으로 고름" },
    m.silhouette !== undefined
      ? { label: "실루엣 점수", value: m.silhouette.toFixed(3), sub: m.silhouette > 0.25 ? "묶음이 비교적 또렷해요" : "묶음 경계가 흐려요", tone: m.silhouette > 0.25 ? "ok" : "warn" }
      : m.perplexity !== undefined
        ? { label: "혼란도", value: String(m.perplexity), sub: "작을수록 자료를 잘 설명" }
        : { label: "자료가 적어요", value: "주의", sub: "4개 이상이면 안정적", tone: "warn" },
  ];
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-[13px]">
        <b className="text-sm">{METHODS.find((x) => x.key === run.method)?.label}</b>
        {adoptedId === run.id ? <Badge tone="ok">이름 붙이기에 쓰는 결과</Badge> : null}
        <span className="text-ink-3">
          {describeParams(run)}. {run.createdBy?.name ?? "이름 없음"}, {new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </p>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-paper-2/70 px-3.5 py-2.5">
            <p className="text-[12px] text-ink-3">{t.label}</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
              <p className="whitespace-nowrap text-xl font-semibold tabular-nums tracking-tight">{t.value}</p>
              {t.sub ? <Badge tone={t.tone ?? "neutral"}>{t.sub}</Badge> : null}
            </div>
          </div>
        ))}
      </div>
      <Warnings result={r} />
    </div>
  );
}

/** 분석 기록·비교: 기록에서 하나를 고르고(A), 다른 하나와 견주고(B), 해석을 적고, 채택한다 */
export function HistoryWindow({
  runs,
  run,
  other,
  compareWith,
  adoptedId,
  materials,
  canEdit,
  canAdopt,
  onSelectRun,
  onCompare,
  onAdopt,
}: {
  runs: RunSummary[];
  run: RunFull | null;
  other: RunFull | null;
  compareWith: string | null;
  adoptedId: string | null;
  materials: Material[];
  canEdit: boolean;
  canAdopt: boolean;
  onSelectRun: (id: string) => void;
  onCompare: (id: string) => void;
  onAdopt: () => void;
}) {
  if (!runs.length) return <NoRun loading={false} canEdit={canEdit} />;
  return (
    <div className="space-y-5">
      <div>
        <WinHeading title={`분석 기록 ${runs.length}`} desc="하나를 고르고(A) 다른 하나와 비교(B)해 보세요." />
        <ol className="space-y-2">
          {runs.map((r, i) => {
            const isSel = r.id === run?.id;
            const isCmp = r.id === compareWith;
            return (
              <li key={r.id} className={clsx("rounded-xl p-2.5", isSel ? "card-sm ring-2 ring-accent" : isCmp ? "card-sm ring-2 ring-warn" : "bg-paper-2/70")}>
                <div className="flex items-start justify-between gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onSelectRun(r.id)}>
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                      #{runs.length - i} {methodShort(r.method)}
                      {r.id === adoptedId ? <Badge tone="ok">채택</Badge> : null}
                      {isSel ? <Badge tone="accent">A</Badge> : isCmp ? <Badge tone="warn">B</Badge> : null}
                    </span>
                    <span className="block text-[11.5px] text-ink-3">{describeParams(r)}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {r.summary.clusters.map((c, j) => (
                        <span key={j} className="inline-flex items-center gap-1 text-[11px] text-ink-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: clusterColor(j) }} />
                          {c.terms.slice(0, 2).join("·")}
                        </span>
                      ))}
                    </span>
                  </button>
                  {!isSel ? (
                    <button
                      onClick={() => onCompare(r.id)}
                      title="지금 결과와 비교"
                      aria-label="지금 결과와 비교"
                      aria-pressed={isCmp}
                      className={clsx("pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-full", isCmp ? "bg-warn text-on-accent" : "bg-paper-2 text-ink-3 hover:bg-paper-3")}
                    >
                      <GitCompare size={14} />
                    </button>
                  ) : null}
                </div>
                {r.note ? <p className="mt-1 line-clamp-2 text-[11.5px] text-ink-2">“{r.note}”</p> : null}
              </li>
            );
          })}
        </ol>
      </div>
      {run ? (
        <>
          <div className="border-t border-line pt-4">
            <WinHeading title="두 결과 비교" desc={other ? "어떤 자료끼리 함께 묶였는지를 비교하세요." : "기록에서 비교 단추를 누르면 나란히 볼 수 있어요."} />
            {other ? <Compare a={run} b={other} materials={materials} /> : null}
          </div>
          <div className="border-t border-line pt-4">
            <WinHeading title="해석 메모" desc="조건을 바꾸니 무엇이 달라졌나요? 결과가 글의 목적과 맞나요?" />
            <RunNote key={run.id} run={run} canEdit={canEdit} />
          </div>
          {canAdopt ? (
            <div className="flex justify-end border-t border-line pt-4">
              <Button variant="primary" onClick={onAdopt} disabled={adoptedId === run.id}>
                이 결과로 이름 붙이기 <ArrowRight size={15} />
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function RunNote({ run, canEdit }: { run: RunFull; canEdit: boolean }) {
  const [note, setNote] = useState(run.note ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  async function save() {
    if (note === (run.note ?? "")) return;
    setSaved("saving");
    try {
      await api(`/api/runs/${run.id}`, { method: "PATCH", json: { note } });
      updateRunCache(run.id, { note });
      setSaved("saved");
    } catch {
      setSaved("idle");
    }
  }
  if (!canEdit) return <p className="text-sm text-ink-2">{run.note || "아직 적지 않았어요."}</p>;
  return (
    <div>
      <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} maxLength={4000} placeholder="예: 불용어에 '자전거'를 넣었더니 광고 자료가 건강 묶음에서 빠졌다." className="text-sm" />
      <p className="mt-1 h-4 text-right text-xs text-ink-3">{saved === "saving" ? "저장하는 중…" : saved === "saved" ? "저장했어요" : ""}</p>
    </div>
  );
}

function Compare({ a, b, materials }: { a: RunFull; b: RunFull; materials: Material[] }) {
  const ca = new Map(a.result.docs.map((d) => [d.id, d.cluster]));
  const cb = new Map(b.result.docs.map((d) => [d.id, d.cluster]));
  const label = (r: RunFull, c: number | undefined) => {
    if (c === undefined) return <span className="text-ink-3">분석에 없음</span>;
    const terms = r.result.clusters
      .find((x) => x.id === c)
      ?.terms.slice(0, 2)
      .map((t) => t.term)
      .join("·");
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: clusterColor(c) }} />
        {c + 1} <span className="text-ink-3">({terms})</span>
      </span>
    );
  };
  const ids = materials.map((m) => m.id).filter((id) => ca.has(id) || cb.has(id));
  const moved = new Set(ids.filter((id) => ids.some((o) => o !== id && ca.has(id) && cb.has(id) && ca.has(o) && cb.has(o) && (ca.get(id) === ca.get(o)) !== (cb.get(id) === cb.get(o)))));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-[12.5px] text-ink-2">
        <span>
          <Badge tone="accent">A</Badge> {describeParams(a)}
        </span>
        <span>
          <Badge tone="warn">B</Badge> {describeParams(b)}
        </span>
        <span className="ml-auto">함께 묶인 짝이 달라진 자료 {moved.size}개</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[13px]">
          <thead className="bg-surface-2 text-left text-[12px] text-ink-3">
            <tr>
              <th className="px-4 py-2 font-medium">자료</th>
              <th className="px-4 py-2 font-medium">A 묶음</th>
              <th className="px-4 py-2 font-medium">B 묶음</th>
            </tr>
          </thead>
          <tbody>
            {materials
              .filter((m) => ca.has(m.id) || cb.has(m.id))
              .map((m) => (
                <tr key={m.id} className={clsx("border-t border-line", moved.has(m.id) && "bg-warn-soft/40")}>
                  <td className="px-4 py-1.5 font-medium">{m.title}</td>
                  <td className="px-4 py-1.5">{label(a, ca.get(m.id))}</td>
                  <td className="px-4 py-1.5">{label(b, cb.get(m.id))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
