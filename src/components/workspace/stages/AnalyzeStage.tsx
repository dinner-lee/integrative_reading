"use client";

import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useStorage, useUpdateMyPresence } from "@liveblocks/react/suspense";
import { ArrowLeft, ArrowRight, Boxes, ChartColumn, GitCompare, Play, SlidersHorizontal, Tags } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/logger";
import { METHODS } from "@/lib/stages";
import { useDialog } from "../../dialogs";
import { Badge, Button, Card, Empty, Notice, Section, SectionTitle, Sections, Spinner, Textarea, clsx, clusterColor } from "../../ui";
import { ClusterPanel, POS_OPTIONS, PreprocessPanel, type Conditions } from "../analysis/Conditions";
import { MorphemeStrip, PreprocessStats, RemovedLists, ResultView } from "../analysis/ResultView";
import { StepDock } from "../analysis/StepDock";
import { useRoomCtx } from "../context";
import { updateRunCache, useMaterials, useRun, useRuns } from "../hooks";
import { MaterialDetail } from "../MaterialDetail";
import { GenerateStage } from "./GenerateStage";
import type { Material, Morpheme, PreprocessStats as Stats, Removed, RunFull, RunSummary } from "../types";

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

/** 군집화 순서: 자료·전처리 → 묶기 → 결과 → 비교·채택 */
/* 하단 플로팅 독의 항목: 아이콘 + 짧은 라벨 */
const STEPS = [
  { key: "prep", label: "자료·전처리", icon: SlidersHorizontal },
  { key: "cluster", label: "묶기", icon: Boxes },
  { key: "result", label: "결과", icon: ChartColumn },
  { key: "compare", label: "비교·채택", icon: GitCompare },
  { key: "name", label: "이름·선별", icon: Tags },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

export function AnalyzeStage() {
  const { groupId, canEdit, viewer, me } = useRoomCtx();
  const { materials } = useMaterials(groupId);
  const { runs, notify: notifyRuns } = useRuns(groupId);
  const board = useStorage((root) => root.board);
  const namedCount = useStorage((root) => root.clusters?.filter((c) => c.name.trim()).length ?? 0);
  const updatePresence = useUpdateMyPresence();

  const [defaults, setDefaults] = useState<{ stopwords: string[]; methods: string[] } | null>(null);
  const [cond, setCond] = useState<Conditions | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Material | null>(null);
  const [stepChosen, setStep] = useState<StepKey | null>(null);
  const { confirm } = useDialog();
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    if (!canEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 둘러보기는 기본값을 서버에서 받지 않음
      setDefaults({ stopwords: [], methods: me?.classroom.enabledMethods ?? ["tfidf_kmeans", "lda"] });
      return;
    }
    api<{ stopwords: string[]; methods: string[] }>("/api/analysis/defaults")
      .then(setDefaults)
      .catch((e) => setError((e as Error).message));
  }, [canEdit, me?.classroom.enabledMethods]);

  // 자료·기본값이 준비되면 조건 초기화 (새 자료가 생기면 자동으로 포함)
  useEffect(() => {
    if (!materials || !defaults) return;
    setCond((c) => {
      if (!c) {
        return {
          method: (defaults.methods[0] as Conditions["method"]) ?? "tfidf_kmeans",
          materialIds: materials.map((m) => m.id),
          preprocess: { pos: "nouns", stopwords: defaults.stopwords, minLength: 1 },
          mining: { k: null, minDf: 1, maxDf: 1, ngram: 1 },
        };
      }
      const ids = new Set(materials.map((m) => m.id));
      const added = materials.filter((m) => !seenRef.current.has(m.id)).map((m) => m.id);
      return { ...c, materialIds: [...c.materialIds.filter((id) => ids.has(id)), ...added] };
    });
    materials.forEach((m) => seenRef.current.add(m.id));
  }, [materials, defaults]);

  const activeId = selected ?? runs?.[0]?.id ?? null;
  const hasRuns = !!runs?.length;
  // 처음엔 전처리부터, 이미 분석한 적이 있으면 결과부터
  const step: StepKey = stepChosen ?? (hasRuns ? "result" : canEdit ? "prep" : "result");

  useEffect(() => {
    updatePresence({ focus: `${step}:${activeId ?? ""}` });
  }, [activeId, step, updatePresence]);

  const { run } = useRun(activeId);
  const { run: other } = useRun(compareWith);

  function go(next: StepKey) {
    setStep(next);
    track("analysis.step", { step: next }, { stage: "analyze" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runAnalysis() {
    if (!cond) return;
    setRunning(true);
    setError(null);
    try {
      const body = { ...cond, mining: { ...cond.mining, k: cond.method === "tfidf_kmeans" ? cond.mining.k : (cond.mining.k ?? 3) } };
      const r = await api<{ run: { id: string } }>("/api/runs", { method: "POST", json: body });
      setSelected(r.run.id);
      setCompareWith(null);
      notifyRuns();
      go("result");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const adopt = useMutation(
    ({ storage, self }, r: RunFull, allMaterialIds: string[]) => {
      const clusters = storage.get("clusters");
      clusters.clear();
      const inRun = new Set(r.result.docs.map((d) => d.id));
      r.result.clusters.forEach((c) =>
        clusters.push(
          new LiveObject({
            id: nanoid(8),
            name: "",
            note: "",
            keywords: c.terms.slice(0, 6).map((t) => t.term),
            origin: "ai" as const,
            materialIds: new LiveList(c.docIds),
          }),
        ),
      );
      const leftOut = allMaterialIds.filter((id) => !inRun.has(id));
      if (leftOut.length) {
        clusters.push(
          new LiveObject({ id: nanoid(8), name: "분석에 넣지 않은 자료", note: "", keywords: [], origin: "human" as const, materialIds: new LiveList(leftOut) }),
        );
      }
      storage.get("board").update({ runId: r.id, method: r.method, adoptedAt: Date.now(), adoptedBy: self.info.name });
    },
    [],
  );

  async function onAdopt() {
    if (!run || !materials) return;
    if (board?.runId && namedCount > 0) {
      const ok = await confirm({
        title: "이 결과로 묶음을 다시 만들까요?",
        body: "이미 이름을 붙인 묶음이 있어요. 바꾸면 묶음 이름과 메모가 사라져요. 선정·보류·제외 판단은 남아요.",
        confirmLabel: "다시 만들기",
        danger: true,
      });
      if (!ok) return;
    }
    adopt(run, materials.map((m) => m.id));
    track("analysis.adopt", { runId: run.id, method: run.method, replaced: board?.runId ?? null }, { stage: "analyze" });
    go("name");
  }

  function addStopword(w: string) {
    if (!cond) return;
    setCond({ ...cond, preprocess: { ...cond.preprocess, stopwords: [...new Set([...cond.preprocess.stopwords, w])] } });
    track("analysis.add_stopword_from_result", { word: w, runId: activeId }, { stage: "analyze" });
  }

  if (!materials || !defaults) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-ink-3">
        <Spinner /> 불러오는 중…
      </div>
    );
  }

  if (materials.length < 2) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionTitle title="자료 분석하기" />
        <Empty title="자료가 2개 이상 있어야 분석할 수 있어요">자료 모으기 단계에서 자료를 더 등록해 주세요. 4개 이상이면 결과가 더 안정적이에요.</Empty>
      </div>
    );
  }

  const canStep = (k: StepKey) => (k === "result" || k === "compare" ? hasRuns : k === "name" ? true : canEdit);
  // 읽기 전용(교사·다른 모둠)은 조건 걸음을 숨기고, 아직 분석이 없으면 결과·비교는 비활성
  const dockItems = STEPS.filter((s) => canEdit || s.key === "result" || s.key === "compare" || s.key === "name").map((s) => ({ key: s.key, label: s.label, icon: s.icon, disabled: !canStep(s.key) }));

  return (
    <div className="mx-auto max-w-6xl pb-40 sm:pb-28">
      <SectionTitle title="자료 분석하기" desc="자료를 낱말로 바꾸고, 묶고, 결과를 읽고 비교한 뒤, 묶음에 이름을 붙이고 자료를 골라요." />
      <StepDock value={step} onChange={(v) => canStep(v) && go(v)} items={dockItems} label="분석 걸음" />
      {error ? (
        <Notice tone="bad" className="mb-5">
          {error}
        </Notice>
      ) : null}

      {step === "prep" && cond ? (
        <>
          <div className="grid gap-10 xl:grid-cols-[1fr_380px]">
            <PreprocessPanel value={cond} onChange={setCond} materials={materials} defaultStopwords={defaults.stopwords} disabled={running} />
            <PreprocessPreview cond={cond} materials={materials} />
          </div>
          <StepNav next={{ label: "다음: 묶기", onClick: () => go("cluster") }} />
        </>
      ) : null}

      {step === "cluster" && cond ? (
        <>
          <ClusterPanel value={cond} onChange={setCond} methods={defaults.methods} disabled={running} />
          <StepNav
            prev={{ label: "자료·전처리", onClick: () => go("prep") }}
            next={{ label: running ? "분석하는 중…" : "분석하기", onClick: runAnalysis, primary: true, loading: running, disabled: cond.materialIds.length < 2, icon: <Play size={15} /> }}
            note={`자료 ${cond.materialIds.length}개, ${POS_OPTIONS.find((o) => o.value === cond.preprocess.pos)?.label}, 불용어 ${cond.preprocess.stopwords.length}개로 묶어요.`}
          />
        </>
      ) : null}

      {step === "result" ? (
        !hasRuns ? (
          <Empty title="아직 분석한 적이 없어요">{canEdit ? "1 자료·전처리와 2 묶기를 마치면 여기서 결과를 볼 수 있어요." : "모둠이 아직 분석하지 않았어요."}</Empty>
        ) : !run ? (
          <div className="flex items-center gap-2 py-10 text-sm text-ink-3">
            <Spinner /> 결과를 불러오는 중…
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">{METHODS.find((m) => m.key === run.method)?.label}</h2>
              {board?.runId === run.id ? <Badge tone="ok">이름 붙이기에 쓰는 결과</Badge> : null}
              <span className="text-[13px] text-ink-3">
                {describeParams(run)}. {run.createdBy?.name ?? "이름 없음"}, {new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {runs && runs.length > 1 ? (
                <select
                  value={run.id}
                  onChange={(e) => setSelected(e.target.value)}
                  className="ml-auto h-9 rounded-full bg-paper-2 px-3 text-[13px] font-medium text-ink-2"
                  aria-label="볼 결과 고르기"
                >
                  {runs.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      #{runs.length - i} {describeParams(r)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <Metrics run={run} />
            <div className="mt-6">
              <ResultView key={run.id} runId={run.id} result={run.result} materials={materials} onOpenMaterial={setViewing} onAddStopword={canEdit ? addStopword : undefined} />
            </div>
            <StepNav
              prev={canEdit ? { label: "조건 바꿔 다시 묶기", onClick: () => go("cluster") } : undefined}
              next={{ label: "다음: 비교·채택", onClick: () => go("compare") }}
            />
          </>
        )
      ) : null}

      {step === "compare" ? (
        !hasRuns || !run ? (
          <Empty title="비교할 결과가 없어요">먼저 분석을 한 번 해 보세요.</Empty>
        ) : (
          <>
            <div className="grid gap-10 xl:grid-cols-[380px_1fr]">
              <div className="panel self-start p-5">
                <RunHistory
                  runs={runs!}
                  selected={run.id}
                  compareWith={compareWith}
                  adoptedId={board?.runId ?? null}
                  onSelect={(id) => {
                    setSelected(id);
                    if (compareWith === id) setCompareWith(null);
                    track("analysis.select_run", { runId: id }, { stage: "analyze" });
                  }}
                  onCompare={(id) => {
                    setCompareWith(id === compareWith ? null : id);
                    if (id !== compareWith) track("analysis.compare", { a: run.id, b: id }, { stage: "analyze" });
                  }}
                />
              </div>
              <div className="panel min-w-0 px-6 py-6 sm:px-8 sm:py-7">
                <Sections>
                  <Section title="두 결과 비교" desc={other ? "묶음 번호는 분석할 때마다 새로 붙어요. 어떤 자료끼리 함께 묶였는지를 비교하세요." : "왼쪽 기록에서 비교 단추를 누르면 지금 결과와 나란히 볼 수 있어요."}>
                    {other ? <Compare a={run} b={other} materials={materials} /> : <Empty title="비교할 결과를 골라 주세요" />}
                  </Section>
                  <Section title="해석 메모" desc="조건을 바꾸니 무엇이 달라졌나요? 결과가 글의 목적과 맞나요?">
                    <RunNote key={run.id} run={run} canEdit={canEdit} />
                  </Section>
                  <Section title="이 결과로 이름 붙이기" desc="고른 결과의 묶음으로 5 이름·선별을 시작해요. 분석에 넣지 않은 자료는 따로 모여요.">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm">
                        <b>{METHODS.find((m) => m.key === run.method)?.short}</b>, {describeParams(run).split(", ").slice(1).join(", ")}
                      </span>
                      {canEdit && viewer.role === "student" ? (
                        <Button variant="primary" onClick={onAdopt} disabled={board?.runId === run.id} className="ml-auto">
                          이 결과로 이름 붙이기 <ArrowRight size={15} />
                        </Button>
                      ) : board?.runId === run.id ? (
                        <Badge tone="ok">채택된 결과</Badge>
                      ) : null}
                    </div>
                  </Section>
                </Sections>
              </div>
            </div>
            <StepNav prev={{ label: "결과", onClick: () => go("result") }} next={{ label: "다음: 이름·선별", onClick: () => go("name") }} />
          </>
        )
      ) : null}

      {step === "name" ? (
        <>
          <GenerateStage onGoAnalyze={canEdit ? () => go("cluster") : undefined} />
          <StepNav prev={{ label: "비교·채택", onClick: () => go("compare") }} />
        </>
      ) : null}

      <MaterialDetail material={viewing} onClose={() => setViewing(null)} stage="analyze" />
    </div>
  );
}

/** 단계 아래 진행 단추 */
function StepNav({
  prev,
  next,
  note,
}: {
  prev?: { label: string; onClick: () => void };
  next?: { label: string; onClick: () => void; primary?: boolean; loading?: boolean; disabled?: boolean; icon?: React.ReactNode };
  note?: string;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
      {prev ? (
        <Button variant="ghost" onClick={prev.onClick}>
          <ArrowLeft size={15} /> {prev.label}
        </Button>
      ) : null}
      {note ? <span className="text-sm text-ink-3">{note}</span> : null}
      {next ? (
        <Button variant={next.primary ? "primary" : "secondary"} onClick={next.onClick} loading={next.loading} disabled={next.disabled} className="ml-auto">
          {next.loading ? null : next.icon}
          {next.label}
          {next.primary ? null : <ArrowRight size={15} />}
        </Button>
      ) : null}
    </div>
  );
}

/** 결과 요약 지표 타일 */
function Metrics({ run }: { run: RunFull }) {
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className="px-5 py-4">
          <p className="text-sm text-ink-3">{t.label}</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{t.value}</p>
            {t.sub ? <Badge tone={t.tone ?? "neutral"}>{t.sub}</Badge> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

function RunHistory({
  runs,
  selected,
  compareWith,
  adoptedId,
  onSelect,
  onCompare,
}: {
  runs: RunSummary[];
  selected: string | null;
  compareWith: string | null;
  adoptedId: string | null;
  onSelect: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold tracking-tight">분석 기록 {runs.length}</h2>
      <p className="mb-4 mt-0.5 text-sm text-ink-3">조건을 바꿔 가며 한 분석이 모두 남아요. 하나를 고르고 다른 하나와 비교해 보세요.</p>
      <ol className="space-y-2">
        {runs.map((r, i) => {
          const isSel = r.id === selected;
          const isCmp = r.id === compareWith;
          return (
            <li key={r.id} className={clsx("rounded-2xl p-3 transition-[box-shadow,background-color]", isSel ? "card-sm ring-2 ring-accent" : isCmp ? "card-sm ring-2 ring-warn" : "bg-paper-2/70")}>
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(r.id)}>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    #{runs.length - i} {methodShort(r.method)}
                    {r.id === adoptedId ? <Badge tone="ok">채택</Badge> : null}
                    {isSel ? <Badge tone="accent">A</Badge> : isCmp ? <Badge tone="warn">B</Badge> : null}
                  </span>
                  <span className="block text-xs text-ink-3">{describeParams(r)}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
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
                    className={clsx("pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full", isCmp ? "bg-warn text-on-accent" : "bg-paper-2 text-ink-3 hover:bg-paper-3")}
                  >
                    <GitCompare size={15} />
                  </button>
                ) : null}
              </div>
              {r.note ? <p className="mt-1.5 line-clamp-2 text-xs text-ink-2">“{r.note}”</p> : null}
            </li>
          );
        })}
      </ol>
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
      <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} maxLength={4000} placeholder="예: 불용어에 '자전거'를 넣었더니 광고 자료가 건강 묶음에서 빠졌다." />
      <p className="mt-1.5 h-4 text-right text-xs text-ink-3">{saved === "saving" ? "저장하는 중…" : saved === "saved" ? "저장했어요" : ""}</p>
    </div>
  );
}

function Compare({ a, b, materials }: { a: RunFull; b: RunFull; materials: Material[] }) {
  const ca = new Map(a.result.docs.map((d) => [d.id, d.cluster]));
  const cb = new Map(b.result.docs.map((d) => [d.id, d.cluster]));
  const label = (r: RunFull, c: number | undefined) => {
    if (c === undefined) return <span className="text-ink-3">분석에 없음</span>;
    const terms = r.result.clusters.find((x) => x.id === c)?.terms.slice(0, 2).map((t) => t.term).join("·");
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: clusterColor(c) }} />
        {c + 1} <span className="text-ink-3">({terms})</span>
      </span>
    );
  };
  const ids = materials.map((m) => m.id).filter((id) => ca.has(id) || cb.has(id));
  const moved = new Set(
    ids.filter((id) =>
      ids.some((o) => o !== id && ca.has(id) && cb.has(id) && ca.has(o) && cb.has(o) && (ca.get(id) === ca.get(o)) !== (cb.get(id) === cb.get(o))),
    ),
  );
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-[13px] text-ink-2">
        <span>
          <Badge tone="accent">A</Badge> {describeParams(a)}
        </span>
        <span>
          <Badge tone="warn">B</Badge> {describeParams(b)}
        </span>
        <span className="ml-auto">함께 묶인 짝이 달라진 자료 {moved.size}개</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-surface-2 text-left text-[13px] text-ink-3">
            <tr>
              <th className="px-5 py-2 font-medium">자료</th>
              <th className="px-5 py-2 font-medium">A 묶음</th>
              <th className="px-5 py-2 font-medium">B 묶음</th>
            </tr>
          </thead>
          <tbody>
            {materials
              .filter((m) => ca.has(m.id) || cb.has(m.id))
              .map((m) => (
                <tr key={m.id} className={clsx("border-t border-line", moved.has(m.id) && "bg-warn-soft/40")}>
                  <td className="px-5 py-2 font-medium">{m.title}</td>
                  <td className="px-5 py-2">{label(a, ca.get(m.id))}</td>
                  <td className="px-5 py-2">{label(b, cb.get(m.id))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** ① 단계 오른쪽: 고른 조건으로 원문이 낱말로 바뀌는 모습 (자료 하나씩) */
function PreprocessPreview({ cond, materials }: { cond: Conditions; materials: Material[] }) {
  const usable = useMemo(() => materials.filter((m) => cond.materialIds.includes(m.id)), [materials, cond.materialIds]);
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<{ stats: Stats; removed: Removed; morphemes: Morpheme[]; tokens: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = usable.some((m) => m.id === id) ? id : (usable[0]?.id ?? null);
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
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <aside className="xl:sticky xl:top-28 xl:self-start">
      <h2 className="text-lg font-bold tracking-tight">전처리 미리보기</h2>
      <p className="mb-4 mt-0.5 text-sm text-ink-3">지금 조건으로 원문이 어떻게 분석용 낱말로 바뀌는지 봐요. 파란 낱말만 분석에 쓰여요.</p>
      {usable.length ? (
        <select value={current ?? ""} onChange={(e) => setId(e.target.value)} className="mb-3 h-10 w-full rounded-full bg-paper-2 px-4 text-sm font-medium" aria-label="미리볼 자료">
          {usable.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      ) : (
        <Empty title="분석에 넣은 자료가 없어요" />
      )}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {current ? (
        <Card className={clsx("p-4 transition-opacity", loading && "opacity-60")}>
          {data ? (
            <>
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
              <p className="mb-2 mt-4 text-[13px] font-semibold">형태소 (파란 낱말만 분석에 쓰여요)</p>
              <div className="max-h-56 overflow-y-auto">
                <MorphemeStrip morphemes={data.morphemes} />
              </div>
              <p className="mb-2 mt-4 text-[13px] font-semibold">빠진 낱말</p>
              <RemovedLists removed={data.removed} />
            </>
          ) : (
            <div className="flex items-center gap-2 py-8 text-sm text-ink-3">
              <Spinner /> 형태소 분석 중…
            </div>
          )}
        </Card>
      ) : null}
    </aside>
  );
}

// 아래는 다른 화면에서 재사용하는 보조 표시
export { PreprocessStats };
