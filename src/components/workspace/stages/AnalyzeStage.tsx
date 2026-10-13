"use client";

import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useStorage, useUpdateMyPresence } from "@liveblocks/react/suspense";
import { ArrowRight, Ban, Boxes, ChartColumn, ChartScatter, Gauge, GitCompare, Grid3x3, Maximize2, Minimize2, Play, Settings2, Table2, Tags, Type, type LucideIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/logger";
import { METHODS } from "@/lib/stages";
import { useDialog } from "../../dialogs";
import { Badge, Button, Collapse, Empty, Notice, SectionTitle, Spinner, clsx } from "../../ui";
import { ClusterSettings, StopwordEditor } from "../analysis/Conditions";
import { Clusters, KChart, MapView, Similarity, TermTable } from "../analysis/ResultView";
import { useSharedConditions } from "../analysis/shared";
import { HistoryWindow, MaterialTable, NoRun, PreprocessWindow, SummaryWindow, describeParams } from "../analysis/windows";
import { Canvas, LAYOUT_GAP as G, MenuButton, NARROW, ToolPalette, WindowFrame, extentOf, useLayout, type Layout, type Win } from "../analysis/Workspace";
import { useRoomCtx } from "../context";
import { primeRunCache, useMaterials, useRun, useRuns } from "../hooks";
import { MaterialDetail } from "../MaterialDetail";
import { ClusterBoard } from "./GenerateStage";
import type { Material, RunFull } from "../types";

export { describeParams };

/* 작업대의 창(도구) */
type Tool = "table" | "prep" | "stopwords" | "method" | "summary" | "terms" | "similarity" | "clusters" | "map" | "history" | "board";
type Preset = "prep" | "result" | "name";

const TOOLS: Record<Tool, { label: string; icon: LucideIcon }> = {
  table: { label: "자료 표", icon: Table2 },
  prep: { label: "형태소·전처리", icon: Type },
  stopwords: { label: "불용어", icon: Ban },
  method: { label: "묶기 조건", icon: Settings2 },
  summary: { label: "결과 요약", icon: Gauge },
  terms: { label: "낱말 점수", icon: ChartColumn },
  similarity: { label: "자료 사이 거리", icon: Grid3x3 },
  clusters: { label: "묶음", icon: Boxes },
  map: { label: "자료 지도", icon: ChartScatter },
  history: { label: "분석 기록·비교", icon: GitCompare },
  board: { label: "묶음 판", icon: Tags },
};

const GROUPS: { step: number; label: string; tools: Tool[] }[] = [
  { step: 1, label: "준비", tools: ["table", "stopwords", "prep"] },
  { step: 2, label: "묶기", tools: ["method"] },
  { step: 3, label: "결과", tools: ["summary", "clusters", "map", "terms", "similarity"] },
  { step: 4, label: "비교", tools: ["history"] },
  { step: 5, label: "선별", tools: ["board"] },
];

const PRESET_LABEL: Record<Preset, string> = { prep: "자료 준비", result: "결과 보기", name: "이름·선별" };

/** 기본 배치 세 가지: 작업 공간 크기에 맞춰 창을 나눠 놓는다 */
function presetFor(name: Preset, W: number, H: number): Layout<Tool> {
  const w = Math.max(W, 760);
  const h = Math.max(H, 480);
  const wins: Partial<Record<Tool, Win>> = {};
  let order: Tool[];
  if (name === "prep") {
    const inner = w - G * 4;
    const c1 = Math.round(inner * 0.4);
    const c2 = Math.round(inner * 0.33);
    const c3 = inner - c1 - c2;
    const hh = Math.round((h - G * 3) / 2);
    wins.table = { x: G, y: G, w: c1, h: h - G * 2 };
    wins.prep = { x: G * 2 + c1, y: G, w: c2, h: h - G * 2 };
    wins.method = { x: G * 3 + c1 + c2, y: G, w: c3, h: hh };
    wins.stopwords = { x: G * 3 + c1 + c2, y: G * 2 + hh, w: c3, h: h - G * 3 - hh };
    order = ["stopwords", "method", "prep", "table"];
  } else if (name === "result") {
    const sh = 168;
    const half = Math.round((w - G * 3) / 2);
    const rest = h - sh - G * 3;
    const rh = Math.round((rest - G) / 2);
    wins.summary = { x: G, y: G, w: w - G * 2, h: sh };
    wins.clusters = { x: G, y: sh + G * 2, w: half, h: rest };
    wins.map = { x: G * 2 + half, y: sh + G * 2, w: w - G * 3 - half, h: rh };
    wins.terms = { x: G * 2 + half, y: sh + G * 3 + rh, w: w - G * 3 - half, h: rest - G - rh };
    order = ["terms", "map", "clusters", "summary"];
  } else {
    const lw = Math.round((w - G * 3) * 0.5);
    const rw = w - G * 3 - lw;
    const th = Math.round((h - G * 3) * 0.56);
    wins.board = { x: G, y: G, w: lw, h: h - G * 2 };
    wins.table = { x: G * 2 + lw, y: G, w: rw, h: th };
    wins.map = { x: G * 2 + lw, y: G * 2 + th, w: rw, h: h - G * 3 - th };
    order = ["map", "table", "board"];
  }
  return { wins, order, max: null };
}

/** 창 하나를 처음 열 때의 자리: 기본 배치에 들어 있는 창은 그 자리, 아니면 가운데쯤 계단식 */
function homeOf(tool: Tool, W: number, H: number, n: number): Win {
  for (const p of ["prep", "result", "name"] as Preset[]) {
    const win = presetFor(p, W, H).wins[tool];
    if (win) return win;
  }
  const w = Math.min(680, Math.max(360, Math.round(W * 0.5)));
  const h = Math.min(560, Math.max(320, Math.round(H * 0.78)));
  const off = (n % 5) * 28;
  return { x: Math.max(G, Math.round((W - w) / 2) + off), y: G * 2 + off, w, h };
}

export function AnalyzeStage() {
  const { groupId, canEdit, viewer, me } = useRoomCtx();
  const { materials } = useMaterials(groupId);
  const { runs, notify: notifyRuns } = useRuns(groupId);
  const board = useStorage((root) => root.board);
  const namedCount = useStorage((root) => root.clusters?.filter((c) => c.name.trim()).length ?? 0);
  const updatePresence = useUpdateMyPresence();

  const [defaults, setDefaults] = useState<{ stopwords: string[]; methods: string[] } | null>(null);
  const [cond, setCond] = useSharedConditions(materials, defaults);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Material | null>(null);
  // 창끼리 이어지는 선택(자료 하나)
  const [picked, setPicked] = useState<string | null>(null);
  const { confirm } = useDialog();

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

  const activeId = selectedRun ?? runs?.[0]?.id ?? null;
  const { run } = useRun(activeId);
  const { run: other } = useRun(compareWith);

  useEffect(() => {
    updatePresence({ focus: `analyze:${activeId ?? ""}` });
  }, [activeId, updatePresence]);

  const select = useCallback((id: string) => {
    setPicked((cur) => (cur === id ? cur : id));
    track("analysis.select_material", { materialId: id }, { stage: "analyze" });
  }, []);

  const ready = !!materials && !!defaults && runs !== null && !!cond;
  if (!ready) {
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

  const initialPreset: Preset = board?.runId ? "name" : runs.length ? "result" : canEdit ? "prep" : "result";

  return (
    <AnalyzeWorkbench
      key={groupId}
      storageKey={`iwl.analyze.layout.${groupId}.${viewer.role}.${viewer.id}`}
      initialPreset={initialPreset}
      materials={materials}
      defaults={defaults}
      cond={cond}
      setCond={setCond}
      runs={runs}
      run={run}
      other={other}
      activeId={activeId}
      compareWith={compareWith}
      running={running}
      error={error}
      canEdit={canEdit}
      canAdopt={canEdit && viewer.role === "student"}
      adoptedId={board?.runId ?? null}
      namedCount={namedCount}
      picked={picked}
      onPick={select}
      onOpenMaterial={setViewing}
      onSelectRun={(id) => {
        setSelectedRun(id);
        if (compareWith === id) setCompareWith(null);
        track("analysis.select_run", { runId: id }, { stage: "analyze" });
      }}
      onCompare={(id) => {
        setCompareWith(id === compareWith ? null : id);
        if (id !== compareWith) track("analysis.compare", { a: activeId, b: id }, { stage: "analyze" });
      }}
      runAnalysis={async () => {
        setRunning(true);
        setError(null);
        try {
          const body = { ...cond, mining: { ...cond.mining, k: cond.method === "tfidf_kmeans" ? cond.mining.k : (cond.mining.k ?? 3) } };
          const r = await api<{ run: RunFull }>("/api/runs", { method: "POST", json: body });
          primeRunCache(r.run);
          setSelectedRun(r.run.id);
          setCompareWith(null);
          notifyRuns();
          return true;
        } catch (e) {
          setError((e as Error).message);
          return false;
        } finally {
          setRunning(false);
        }
      }}
      confirm={confirm}
    >
      <MaterialDetail material={viewing} onClose={() => setViewing(null)} stage="analyze" />
    </AnalyzeWorkbench>
  );
}

function AnalyzeWorkbench({
  storageKey,
  initialPreset,
  materials,
  defaults,
  cond,
  setCond,
  runs,
  run,
  other,
  activeId,
  compareWith,
  running,
  error,
  canEdit,
  canAdopt,
  adoptedId,
  namedCount,
  picked,
  onPick,
  onOpenMaterial,
  onSelectRun,
  onCompare,
  runAnalysis,
  confirm,
  children,
}: {
  storageKey: string;
  initialPreset: Preset;
  materials: Material[];
  defaults: { stopwords: string[]; methods: string[] };
  cond: NonNullable<ReturnType<typeof useSharedConditions>[0]>;
  setCond: ReturnType<typeof useSharedConditions>[1];
  runs: NonNullable<ReturnType<typeof useRuns>["runs"]>;
  run: RunFull | null;
  other: RunFull | null;
  activeId: string | null;
  compareWith: string | null;
  running: boolean;
  error: string | null;
  canEdit: boolean;
  canAdopt: boolean;
  adoptedId: string | null;
  namedCount: number;
  picked: string | null;
  onPick: (id: string) => void;
  onOpenMaterial: (m: Material) => void;
  onSelectRun: (id: string) => void;
  onCompare: (id: string) => void;
  runAnalysis: () => Promise<boolean>;
  confirm: ReturnType<typeof useDialog>["confirm"];
  children: React.ReactNode;
}) {
  const L = useLayout<Tool, Preset>({ storageKey, initialPreset, presetFor, homeOf });
  // 작업대 크게: 위 안내 띠를 접고 작업대를 화면 높이에 맞춘다
  const fullKey = `${storageKey}.full`;
  const [full, setFull] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(fullKey) === "1";
    } catch {
      return false;
    }
  });
  const toggleFull = () => {
    const next = !full;
    L.fitNextResize();
    setFull(next);
    try {
      window.localStorage.setItem(fullKey, next ? "1" : "0");
    } catch {
      /* 저장이 막혀도 이번 화면에서는 바뀐다 */
    }
    track("analysis.workbench_full", { on: next }, { stage: "analyze" });
  };
  const narrow = L.size.w > 0 && L.size.w < NARROW;
  const top = L.layout?.order[L.layout.order.length - 1] ?? null;
  const openSet = new Set(L.layout?.order ?? []);
  const openMaterial = (id: string) => {
    const m = materials.find((x) => x.id === id);
    if (m) onOpenMaterial(m);
  };

  const openTool = (t: Tool, via: string) => {
    if (!openSet.has(t)) track("analysis.window_open", { tool: t, via }, { stage: "analyze" });
    L.open(t);
  };
  const applyPreset = (p: Preset, via: string) => {
    L.preset(p);
    track("analysis.layout_preset", { preset: p, via }, { stage: "analyze" });
  };

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
        clusters.push(new LiveObject({ id: nanoid(8), name: "분석에 넣지 않은 자료", note: "", keywords: [], origin: "human" as const, materialIds: new LiveList(leftOut) }));
      }
      storage.get("board").update({ runId: r.id, method: r.method, adoptedAt: Date.now(), adoptedBy: self.info.name });
    },
    [],
  );

  async function onAdopt() {
    if (!run) return;
    if (adoptedId && namedCount > 0) {
      const ok = await confirm({
        title: "이 결과로 묶음을 다시 만들까요?",
        body: "이미 이름을 붙인 묶음이 있어요. 바꾸면 묶음 이름과 메모가 사라져요. 선정·보류·제외 판단은 남아요.",
        confirmLabel: "다시 만들기",
        danger: true,
      });
      if (!ok) return;
    }
    adopt(
      run,
      materials.map((m) => m.id),
    );
    track("analysis.adopt", { runId: run.id, method: run.method, replaced: adoptedId }, { stage: "analyze" });
    applyPreset("name", "adopt");
  }

  async function onRun() {
    track("analysis.run_click", { method: cond.method, k: cond.mining.k }, { stage: "analyze" });
    const ok = await runAnalysis();
    if (ok) L.ensureOpen(["summary", "clusters", "map", "terms"]);
  }

  function addStopword(w: string) {
    setCond({ ...cond, preprocess: { ...cond.preprocess, stopwords: [...new Set([...cond.preprocess.stopwords, w])] } });
    track("analysis.add_stopword_from_result", { word: w, runId: activeId }, { stage: "analyze" });
  }

  const sel = { selected: picked, onSelect: onPick };
  const resultBody = (render: (r: RunFull) => React.ReactNode) => (run ? render(run) : <NoRun loading={!!runs.length} canEdit={canEdit} />);

  const content: Record<Tool, { node: React.ReactNode; body?: string }> = {
    table: { node: <MaterialTable materials={materials} cond={cond} setCond={setCond} canEdit={canEdit} run={run} onOpen={onOpenMaterial} {...sel} />, body: "p-3" },
    prep: { node: <PreprocessWindow cond={cond} setCond={setCond} materials={materials} canEdit={canEdit} {...sel} /> },
    stopwords: {
      node: (
        <fieldset disabled={!canEdit || running}>
          <StopwordEditor value={cond} onChange={setCond} defaultStopwords={defaults.stopwords} />
        </fieldset>
      ),
    },
    method: {
      node: (
        <fieldset disabled={!canEdit || running}>
          <ClusterSettings value={cond} onChange={setCond} methods={defaults.methods} />
        </fieldset>
      ),
    },
    summary: { node: resultBody((r) => <SummaryWindow run={r} adoptedId={adoptedId} />) },
    terms: { node: resultBody((r) => <TermTable key={r.id} result={r.result} open={openMaterial} {...sel} />) },
    similarity: { node: resultBody((r) => <Similarity key={r.id} result={r.result} {...sel} />) },
    clusters: {
      node: resultBody((r) => (
        <div className="space-y-3">
          <Clusters key={r.id} result={r.result} open={openMaterial} onAddStopword={canEdit ? addStopword : undefined} {...sel} />
          {r.result.kCandidates.length ? <KChart result={r.result} /> : null}
        </div>
      )),
    },
    map: { node: resultBody((r) => <MapView key={r.id} result={r.result} open={openMaterial} {...sel} />) },
    history: {
      node: (
        <HistoryWindow
          runs={runs}
          run={run}
          other={other}
          compareWith={compareWith}
          adoptedId={adoptedId}
          materials={materials}
          canEdit={canEdit}
          canAdopt={canAdopt}
          onSelectRun={onSelectRun}
          onCompare={onCompare}
          onAdopt={onAdopt}
        />
      ),
    },
    board: { node: <ClusterBoard onStartAnalysis={canEdit ? () => openTool("method", "board_empty") : undefined} onOpen={onOpenMaterial} {...sel} />, body: "p-3" },
  };

  const kChoices = cond.method === "tfidf_kmeans" ? [null, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6];
  const layout = L.layout;

  return (
    // 작업대 크게: 페이지 최대 폭을 벗어나 화면 가로폭(양옆 1rem)까지 넓힌다 (부모 가운데 정렬 기준으로 왼쪽을 화면 끝에 맞춤)
    <div
      className={clsx(
        "transition-[width,margin] duration-300 ease-out motion-reduce:transition-none",
        full ? "ml-[calc(50%-50vw+1rem)] w-[calc(100vw-2rem)] max-w-none" : "mx-auto w-full max-w-[1400px]",
      )}
    >
      <Collapse open={!full}>
        <SectionTitle title="자료 분석하기" desc="자료를 낱말로 바꾸고, 묶고, 결과를 읽고 비교한 뒤, 묶음에 이름을 붙이고 자료를 골라요." />
      </Collapse>
      {error ? (
        <Notice tone="bad" className="mb-3">
          {error}
        </Notice>
      ) : null}

      <div className={clsx("card flex min-h-[560px] flex-col overflow-clip transition-[height] duration-300 ease-out motion-reduce:transition-none", full ? "h-[calc(100dvh-112px)]" : "h-[calc(100dvh-236px)]")}>
        {/* 메뉴 막대 */}
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
          <MenuButton
            label="분석"
            items={[
              { label: "분석하기", onSelect: onRun, disabled: !canEdit || running || cond.materialIds.length < 2 },
              { label: "조건을 기본값으로", onSelect: () => setCond({ ...cond, method: (defaults.methods[0] as typeof cond.method) ?? "tfidf_kmeans", materialIds: materials.map((m) => m.id), preprocess: { pos: "nouns", stopwords: defaults.stopwords, minLength: 1 }, mining: { k: null, minDf: 1, maxDf: 1, ngram: 1 } }), disabled: !canEdit },
            ]}
          />
          <MenuButton
            label="보기"
            items={[
              ...(Object.keys(PRESET_LABEL) as Preset[]).map((p) => ({ label: `기본 배치: ${PRESET_LABEL[p]}`, onSelect: () => applyPreset(p, "menu") })),
              "sep" as const,
              { label: "열린 창 모두 닫기", onSelect: () => L.closeAll() },
            ]}
          />
          <MenuButton label="기록" items={[{ label: "분석 기록·비교 열기", onSelect: () => openTool("history", "menu") }]} />
          <span className="mx-1.5 h-5 w-px bg-line" aria-hidden />
          <select
            aria-label="묶는 방법"
            value={cond.method}
            disabled={!canEdit || running}
            onChange={(e) => {
              const m = e.target.value as typeof cond.method;
              setCond({ ...cond, method: m, mining: { ...cond.mining, k: m === "tfidf_kmeans" ? cond.mining.k : (cond.mining.k ?? 3) } });
            }}
            className="select-pill h-8 rounded-full bg-paper-2 pl-3 text-[13px] font-medium disabled:opacity-60"
          >
            {METHODS.filter((m) => defaults.methods.includes(m.key)).map((m) => (
              <option key={m.key} value={m.key}>
                {m.short}
              </option>
            ))}
          </select>
          <select
            aria-label={cond.method === "lda" ? "주제 수" : "묶음 수"}
            value={String(cond.mining.k ?? "auto")}
            disabled={!canEdit || running}
            onChange={(e) => setCond({ ...cond, mining: { ...cond.mining, k: e.target.value === "auto" ? null : Number(e.target.value) } })}
            className="select-pill h-8 rounded-full bg-paper-2 pl-3 text-[13px] font-medium disabled:opacity-60"
          >
            {kChoices.map((k) => (
              <option key={String(k)} value={String(k ?? "auto")}>
                {k ? `${cond.method === "lda" ? "주제" : "묶음"} ${k}개` : "묶음 수 자동"}
              </option>
            ))}
          </select>
          <Button size="sm" variant="primary" onClick={onRun} loading={running} disabled={!canEdit || cond.materialIds.length < 2} className="h-8">
            {running ? null : <Play size={13} />}
            분석하기
          </Button>
          <span className="hidden text-[12px] text-ink-3 xl:inline">
            자료 {cond.materialIds.length}개 · 불용어 {cond.preprocess.stopwords.length}개
          </span>

          <span className="ml-auto flex items-center gap-1.5">
            {runs.length > 1 && run ? (
              <select value={run.id} onChange={(e) => onSelectRun(e.target.value)} className="select-pill h-8 max-w-[18rem] rounded-full bg-paper-2 pl-3 text-[12.5px] font-medium text-ink-2" aria-label="볼 결과 고르기">
                {runs.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    #{runs.length - i} {describeParams(r)}
                  </option>
                ))}
              </select>
            ) : null}
            {run && adoptedId === run.id ? <Badge tone="ok">채택된 결과</Badge> : null}
            {canAdopt && run && adoptedId !== run.id ? (
              <Button size="sm" variant="secondary" onClick={onAdopt} className="h-8">
                이 결과로 이름 붙이기 <ArrowRight size={13} />
              </Button>
            ) : null}
            <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
            <button
              type="button"
              onClick={toggleFull}
              aria-pressed={full}
              aria-label={full ? "작업대 원래 크기로" : "작업대 크게"}
              title={full ? "안내 띠를 다시 펴고 원래 크기로" : "안내 띠를 접고 작업대를 화면에 맞추기"}
              className="pressable flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="hidden lg:inline">{full ? "원래대로" : "작업대 크게"}</span>
            </button>
          </span>
        </div>

        <div className="flex min-h-0 flex-1">
          <ToolPalette groups={GROUPS.map((g) => ({ ...g, tools: g.tools.map((k) => ({ key: k, ...TOOLS[k] })) }))} openTools={openSet} topTool={top} onPick={(t) => openTool(t, "palette")} />
          <Canvas canvasRef={L.canvasRef} extent={layout && !layout.max && !narrow ? extentOf(layout.wins) : { w: 0, h: 0 }}>
            {layout && !layout.order.length ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-3">왼쪽 도구를 눌러 창을 열거나, 보기 메뉴에서 기본 배치를 골라요.</div>
            ) : null}
            {/* DOM 순서는 고정하고 겹침 순서는 z-index로만 바꾼다: 누르는 도중 노드가 옮겨지면 click이 사라진다 */}
            {(Object.keys(TOOLS) as Tool[]).map((t) => {
              const win = layout?.wins[t];
              const i = layout ? layout.order.indexOf(t) : -1;
              if (!layout || !win || i < 0) return null;
              const isTop = t === top;
              const maximized = narrow || layout.max === t || (!!layout.max && isTop);
              return (
                <WindowFrame
                  key={t}
                  title={TOOLS[t].label}
                  icon={TOOLS[t].icon}
                  win={win}
                  z={i + 1}
                  top={isTop}
                  maximized={maximized}
                  hidden={(narrow || !!layout.max) && !isTop}
                  bounds={L.size}
                  onFocus={() => L.focus(t)}
                  onPlace={(p) => L.place(t, p)}
                  onClose={() => {
                    L.close(t);
                    track("analysis.window_close", { tool: t }, { stage: "analyze" });
                  }}
                  onCollapse={() => L.toggleCollapse(t)}
                  onMax={() => L.toggleMax(t)}
                  bodyClassName={clsx(content[t].body ?? "p-4")}
                >
                  {content[t].node}
                </WindowFrame>
              );
            })}
          </Canvas>
        </div>
      </div>
      {children}
    </div>
  );
}
