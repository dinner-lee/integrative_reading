"use client";

import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useStorage, useUpdateMyPresence } from "@liveblocks/react/suspense";
import { ArrowRight, Eye, GitCompare, Play } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/logger";
import { METHODS } from "@/lib/stages";
import { Badge, Button, Card, Empty, Modal, Notice, SectionTitle, Spinner, Textarea, clsx, clusterColor } from "../../ui";
import { useDialog } from "../../dialogs";
import { ConditionsPanel, POS_OPTIONS, type Conditions } from "../analysis/Conditions";
import { MorphemeStrip, PreprocessStats, RemovedLists, ResultView } from "../analysis/ResultView";
import { useRoomCtx } from "../context";
import { updateRunCache, useMaterials, useRun, useRuns } from "../hooks";
import { MaterialDetail } from "../MaterialDetail";
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

export function AnalyzeStage({ onGoNext }: { onGoNext?: () => void }) {
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
  const [preview, setPreview] = useState(false);
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

  // 고른 결과가 없으면 가장 최근 결과를 보여 준다
  const activeId = selected ?? runs?.[0]?.id ?? null;

  useEffect(() => {
    updatePresence({ focus: activeId });
  }, [activeId, updatePresence]);

  const { run } = useRun(activeId);
  const { run: other } = useRun(compareWith);

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
          new LiveObject({
            id: nanoid(8),
            name: "분석에 넣지 않은 자료",
            note: "",
            keywords: [],
            origin: "human" as const,
            materialIds: new LiveList(leftOut),
          }),
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
    onGoNext?.();
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

  return (
    <div>
      <SectionTitle
        title="자료 분석하기"
        desc="조건을 바꿔 가며 자료를 묶어 보고 결과를 비교해요."
      />
      {error ? (
        <Notice tone="bad" className="mb-4">
          {error}
        </Notice>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          {canEdit && cond ? (
            <div className="pr-1">
              <ConditionsPanel
                value={cond}
                onChange={setCond}
                methods={defaults.methods}
                materials={materials}
                defaultStopwords={defaults.stopwords}
                disabled={running}
              />
              <div className="mt-5 flex gap-2">
                <Button type="button" onClick={() => setPreview(true)} disabled={!cond.materialIds.length}>
                  <Eye size={15} /> 전처리 미리보기
                </Button>
                <Button type="button" variant="primary" className="flex-1" onClick={runAnalysis} loading={running} disabled={cond.materialIds.length < 2}>
                  {running ? null : <Play size={15} />} {running ? "분석하는 중…" : "분석하기"}
                </Button>
              </div>
            </div>
          ) : null}
          <RunHistory
            runs={runs}
            selected={activeId}
            compareWith={compareWith}
            adoptedId={board?.runId ?? null}
            onSelect={(id) => {
              setSelected(id);
              if (compareWith === id) setCompareWith(null);
              track("analysis.select_run", { runId: id }, { stage: "analyze" });
            }}
            onCompare={(id) => {
              setCompareWith(id === compareWith ? null : id);
              if (id !== compareWith) track("analysis.compare", { a: activeId, b: id }, { stage: "analyze" });
            }}
          />
        </aside>

        <section className="min-w-0">
          {!runs?.length ? (
            <Empty title="아직 분석한 적이 없어요">왼쪽에서 조건을 고르고 ‘분석하기’를 눌러 보세요.</Empty>
          ) : !run ? (
            <div className="flex items-center gap-2 py-10 text-sm text-ink-3">
              <Spinner /> 결과를 불러오는 중…
            </div>
          ) : (
            <div className="space-y-5">
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{METHODS.find((m) => m.key === run.method)?.label}</h3>
                      {board?.runId === run.id ? <Badge tone="ok">내용 생성하기에 쓰는 결과</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-3">
                      {describeParams(run)}
                      <span className="ml-2">
                        {run.createdBy?.name ?? "이름 없음"}, {new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </p>
                  </div>
                  {canEdit && viewer.role === "student" ? (
                    <Button variant="primary" onClick={onAdopt} disabled={board?.runId === run.id}>
                      이 결과로 내용 생성하기 <ArrowRight size={15} />
                    </Button>
                  ) : null}
                </div>
                <RunNote key={run.id} run={run} canEdit={canEdit} />
              </Card>
              {other ? <Compare a={run} b={other} materials={materials} /> : null}
              <ResultView
                key={run.id}
                runId={run.id}
                result={run.result}
                materials={materials}
                onOpenMaterial={setViewing}
                onAddStopword={canEdit ? addStopword : undefined}
              />
            </div>
          )}
        </section>
      </div>
      <MaterialDetail material={viewing} onClose={() => setViewing(null)} stage="analyze" />
      {cond ? <PreviewModal open={preview} onClose={() => setPreview(false)} cond={cond} materials={materials} /> : null}
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
  runs: RunSummary[] | null;
  selected: string | null;
  compareWith: string | null;
  adoptedId: string | null;
  onSelect: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  if (!runs?.length) return null;
  return (
    <Card className="p-4">
      <h3 className="mb-1 font-bold">분석 기록</h3>
      <p className="mb-3 text-[13px] text-ink-3">조건을 바꿔 가며 한 분석이 모두 남아요. 비교 단추로 두 결과를 나란히 볼 수 있어요.</p>
      <ol className="max-h-[420px] space-y-1.5 overflow-y-auto">
        {runs.map((r, i) => (
          <li key={r.id}>
            <div
              className={clsx(
                "rounded-lg border px-3 py-2",
                r.id === selected ? "border-accent bg-accent-soft/50" : r.id === compareWith ? "border-warn bg-warn-soft/50" : "border-line",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(r.id)}>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    #{runs.length - i} {methodShort(r.method)}
                    {r.id === adoptedId ? <Badge tone="ok">채택</Badge> : null}
                  </span>
                  <span className="block text-xs text-ink-3">{describeParams(r)}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {r.summary.clusters.map((c, j) => (
                      <span key={j} className="inline-flex items-center gap-1 text-[11px] text-ink-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: clusterColor(j) }} />
                        {c.terms.slice(0, 2).join("·")}
                      </span>
                    ))}
                  </span>
                </button>
                {r.id !== selected ? (
                  <button
                    onClick={() => onCompare(r.id)}
                    title="지금 결과와 비교"
                    aria-pressed={r.id === compareWith}
                    className={clsx("rounded-lg p-1 hover:bg-paper-2", r.id === compareWith ? "text-warn" : "text-ink-3")}
                  >
                    <GitCompare size={15} />
                  </button>
                ) : null}
              </div>
              {r.note ? <p className="mt-1 line-clamp-2 text-xs text-ink-2">“{r.note}”</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
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
  if (!canEdit && !run.note) return null;
  return (
    <div className="mt-3">
      <label className="mb-1 block text-[13px] font-semibold text-ink-2">
        해석 메모 <span className="font-normal text-ink-3">(조건을 바꾸니 무엇이 달라졌나요? 결과가 글의 목적과 맞나요?)</span>
      </label>
      {canEdit ? (
        <>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} maxLength={4000} className="text-sm" />
          <p className="h-4 text-right text-xs text-ink-3">{saved === "saving" ? "저장하는 중…" : saved === "saved" ? "저장했어요" : ""}</p>
        </>
      ) : (
        <p className="text-sm text-ink-2">{run.note}</p>
      )}
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
  // 자료 쌍이 같은 묶음에 있었는지 비교해, 짝이 달라진 자료를 표시
  const ids = materials.map((m) => m.id).filter((id) => ca.has(id) || cb.has(id));
  const moved = new Set(
    ids.filter((id) =>
      ids.some((o) => o !== id && ca.has(id) && cb.has(id) && ca.has(o) && cb.has(o) && (ca.get(id) === ca.get(o)) !== (cb.get(id) === cb.get(o))),
    ),
  );
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line bg-warn-soft/50 px-4 py-2.5">
        <h3 className="font-bold">두 결과 비교</h3>
        <p className="text-[13px] text-ink-2">
          <b>A</b> {describeParams(a)} / <b>B</b> {describeParams(b)}. 함께 묶인 짝이 달라진 자료 {moved.size}개
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-[13px] text-ink-3">
            <tr>
              <th className="px-4 py-2 font-semibold">자료</th>
              <th className="px-4 py-2 font-semibold">A 묶음</th>
              <th className="px-4 py-2 font-semibold">B 묶음</th>
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
      <p className="border-t border-line px-4 py-2 text-[13px] text-ink-2">
        묶음 번호는 분석할 때마다 새로 붙어요. 번호보다 <b>어떤 자료끼리 함께 묶였는지</b>를 비교하세요.
      </p>
    </Card>
  );
}

function PreviewModal({ open, onClose, cond, materials }: { open: boolean; onClose: () => void; cond: Conditions; materials: Material[] }) {
  const usable = useMemo(() => materials.filter((m) => cond.materialIds.includes(m.id)), [materials, cond.materialIds]);
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<{ stats: Stats; removed: Removed; morphemes: Morpheme[]; tokens: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = id ?? usable[0]?.id ?? null;
  const key = JSON.stringify([current, cond.preprocess]);

  useEffect(() => {
    if (!open || !current) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 미리보기 요청 시작
    setLoading(true);
    setError(null);
    api<typeof data>("/api/preprocess", { method: "POST", json: { materialId: current, preprocess: cond.preprocess } })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  const m = usable.find((x) => x.id === current);
  return (
    <Modal open={open} onClose={onClose} title="전처리 미리보기" wide>
      <div className="space-y-3">
        <p className="text-sm text-ink-2">지금 고른 품사·불용어 조건으로 원문이 어떻게 분석용 낱말로 바뀌는지 봐요.</p>
        <div className="flex flex-wrap gap-1.5">
          {usable.map((x) => (
            <button
              key={x.id}
              onClick={() => setId(x.id)}
              className={clsx(
                "max-w-[16rem] truncate rounded-full border px-3 py-1 text-[13px]",
                x.id === current ? "border-primary bg-primary font-semibold text-on-primary" : "border-line-strong text-ink-2 hover:bg-paper-2",
              )}
            >
              {x.title}
            </button>
          ))}
        </div>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        {loading || !data ? (
          <div className="flex items-center gap-2 py-8 text-sm text-ink-3">
            <Spinner /> 형태소 분석 중…
          </div>
        ) : (
          <>
            <PreprocessStats stats={data.stats} />
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="mb-2 text-[13px] font-semibold">원문</p>
                <p className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{m?.content.slice(0, 1500)}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="mb-2 text-[13px] font-semibold">형태소 (파란 낱말만 분석에 쓰여요)</p>
                <div className="max-h-60 overflow-y-auto">
                  <MorphemeStrip morphemes={data.morphemes} />
                </div>
              </div>
            </div>
            <RemovedLists removed={data.removed} />
          </>
        )}
      </div>
    </Modal>
  );
}
