"use client";

import { Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";
import { Notice, clsx, clusterColor } from "../../ui";
import type { Material, Morpheme, RunResult } from "../types";

export function Think({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-warn-line bg-warn-soft/60 px-3 py-2.5 text-sm leading-relaxed text-warn-ink">
      <Lightbulb size={16} className="mt-0.5 shrink-0" />
      <div>
        <b>생각해 보기 · </b>
        {children}
      </div>
    </div>
  );
}

/** 읽는 순서: 원문이 낱말로 → 낱말 점수 → 자료 사이 거리 → 묶음 → 지도 */
/** 대시보드 한 칸: 채움 없는 회색 선 상자 + 소제목 */
function Panel({ title, desc, className, children }: { title: string; desc?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx("panel min-w-0 px-5 py-5 sm:px-6", className)} aria-labelledby={`rp-${title}`}>
      <h2 id={`rp-${title}`} className="text-base font-bold tracking-tight">
        {title}
      </h2>
      {desc ? <p className="mt-0.5 text-[13px] text-ink-3">{desc}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ResultView({
  result,
  materials,
  onOpenMaterial,
  onAddStopword,
  runId,
}: {
  result: RunResult;
  materials: Material[];
  onOpenMaterial: (m: Material) => void;
  onAddStopword?: (w: string) => void;
  runId: string;
}) {
  const byId = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const open = (id: string) => {
    const m = byId.get(id);
    if (m) onOpenMaterial(m);
  };

  return (
    <div data-run={runId}>
      {result.warnings.length ? (
        <div className="mb-4 space-y-2">
          {result.warnings.map((w, i) => (
            <Notice key={i} tone="warn">
              {w}
            </Notice>
          ))}
        </div>
      ) : null}
      {/* 탭 대신 대시보드: 읽는 순서대로 다섯 칸, 넓은 화면에선 두 열 */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="1 전처리 결과" desc="원문이 분석용 낱말로 어떻게 바뀌었는지" className="xl:col-span-2">
          <PreprocessResult result={result} />
        </Panel>
        <Panel title="2 낱말 점수" desc="자료마다 어떤 낱말이 중요하게 계산됐는지">
          <TermTable result={result} open={open} />
        </Panel>
        <Panel title="3 자료 사이 거리" desc="낱말 점수가 비슷한 자료일수록 가까워요">
          <Similarity result={result} />
        </Panel>
        <Panel title="4 묶음" desc="함께 묶인 자료와 대표 낱말" className="xl:col-span-2">
          <Clusters result={result} open={open} onAddStopword={onAddStopword} />
        </Panel>
        <Panel title="5 자료 지도" desc="자료를 2차원에 펼쳐 묶음을 한눈에" className="xl:col-span-2">
          <MapView result={result} open={open} />
        </Panel>
      </div>
    </div>
  );
}

function Clusters({ result, open, onAddStopword }: { result: RunResult; open: (id: string) => void; onAddStopword?: (w: string) => void }) {
  const docs = new Map(result.docs.map((d) => [d.id, d]));
  const isLda = result.method === "lda";
  const maxW = Math.max(...result.clusters.flatMap((c) => c.terms.map((t) => t.weight)), 0.0001);
  return (
    <div className="space-y-4">
      <Think>
        {isLda
          ? "LDA는 자료마다 여러 주제가 섞여 있다고 봐요. 아래는 가장 비중이 큰 주제로만 나눈 모습이에요. 막대를 보고 주제가 섞인 자료를 찾아보세요."
          : "같은 묶음에 들어간 자료를 원문과 비교해 보세요. 왜 함께 묶였을까요? 낱말은 비슷하지만 글의 목적에는 맞지 않는 자료는 없나요?"}
      </Think>
      <div className="grid gap-3 lg:grid-cols-2">
        {result.clusters.map((c) => (
          <div key={c.id} className="card-sm p-4" style={{ borderTop: `4px solid ${clusterColor(c.id)}` }}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-bold">
                {isLda ? "주제" : "묶음"} {c.id + 1}
              </h4>
              <span className="text-[13px] text-ink-3">자료 {c.size}개</span>
            </div>
            <p className="mb-1 text-xs text-ink-3">{isLda ? "이 주제에서 나올 확률이 높은 낱말" : "이 묶음을 대표하는 낱말(평균 점수)"}</p>
            <ul className="mb-3 space-y-1">
              {c.terms.slice(0, 8).map((t) => (
                <li key={t.term} className="group flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 truncate font-medium">{t.term}</span>
                  <span className="h-2 flex-1 rounded-full bg-paper-2">
                    <span className="block h-2 rounded-full" style={{ width: `${(t.weight / maxW) * 100}%`, background: clusterColor(c.id) }} />
                  </span>
                  <span className="w-12 text-right text-xs tabular-nums text-ink-3">{t.weight.toFixed(3)}</span>
                  {onAddStopword ? (
                    <button
                      onClick={() => onAddStopword(t.term)}
                      className="invisible text-xs text-ink-3 hover:text-bad group-hover:visible focus:visible"
                      title="이 낱말을 불용어(분석에서 뺄 낱말)에 넣기"
                    >
                      빼기
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <ul className="space-y-1.5 border-t border-line pt-3">
              {c.docIds.map((id) => {
                const d = docs.get(id)!;
                return (
                  <li key={id}>
                    <button onClick={() => open(id)} className="w-full text-left text-sm hover:text-accent">
                      <span className="font-medium">{d.title}</span>
                      {isLda && d.topicDist ? (
                        <TopicBar dist={d.topicDist} />
                      ) : (
                        <span className="ml-1.5 text-xs text-ink-3" title="묶음 한가운데와 얼마나 가까운지(1에 가까울수록 대표적)">
                          가까움 {d.fit.toFixed(2)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {result.kCandidates.length ? <KChart result={result} /> : null}
    </div>
  );
}

function TopicBar({ dist }: { dist: number[] }) {
  return (
    <span className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-paper-2" aria-label={dist.map((v, i) => `주제${i + 1} ${Math.round(v * 100)}%`).join(", ")}>
      {dist.map((v, i) => (
        <span key={i} style={{ width: `${v * 100}%`, background: clusterColor(i) }} title={`주제 ${i + 1}: ${Math.round(v * 100)}%`} />
      ))}
    </span>
  );
}


function KChart({ result }: { result: RunResult }) {
  const max = Math.max(...result.kCandidates.map((c) => c.silhouette), 0.0001);
  return (
    <div className="card-sm p-4">
      <h4 className="font-bold">묶음 수에 따른 실루엣 점수</h4>
      <p className="mb-3 text-[13px] text-ink-3">점수가 높을수록 묶음이 또렷하게 나뉘어요. 하지만 글에 필요한 하위 주제 수와 꼭 같지는 않아요.</p>
      <div className="flex h-28 items-end gap-2">
        {result.kCandidates.map((c) => (
          <div key={c.k} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[11px] tabular-nums text-ink-3">{c.silhouette.toFixed(2)}</span>
            <span
              className={clsx("w-full rounded-t-lg", c.k === result.k ? "bg-accent" : "bg-paper-3")}
              style={{ height: `${Math.max(4, (Math.max(c.silhouette, 0) / max) * 80)}px` }}
            />
            <span className="text-xs font-medium">{c.k}개</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapView({ result, open }: { result: RunResult; open: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 640;
  const H = 400;
  const pad = 40;
  const x = (v: number) => pad + ((v + 1) / 2) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v + 1) / 2) * (H - pad * 2);
  return (
    <div className="space-y-3">
      <Think>
        점 하나가 자료 하나예요. 낱말 점수(또는 의미)를 두 방향으로 줄여 그린 지도라서 가까울수록 비슷한 자료예요. 색이 다른데 가까운 자료나, 같은
        색인데 멀리 떨어진 자료를 찾아 원문을 비교해 보세요.
      </Think>
      <div className="card-sm overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[480px]" role="img" aria-label="자료 지도">
          <line x1={W / 2} x2={W / 2} y1={pad / 2} y2={H - pad / 2} stroke="var(--line)" />
          <line y1={H / 2} y2={H / 2} x1={pad / 2} x2={W - pad / 2} stroke="var(--line)" />
          {result.docs.map((d) => {
            const cx = x(d.coords[0]);
            const cy = y(d.coords[1]);
            const active = hover === d.id;
            return (
              <g
                key={d.id}
                onMouseEnter={() => setHover(d.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => open(d.id)}
                className="cursor-pointer"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && open(d.id)}
              >
                <circle cx={cx} cy={cy} r={active ? 10 : 8} fill={clusterColor(d.cluster)} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
                <text x={cx + 12} y={cy + 4} fontSize={active ? 13 : 11.5} fill="var(--ink)" fontWeight={active ? 700 : 500}>
                  {d.title.length > 16 && !active ? d.title.slice(0, 15) + "…" : d.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 text-[13px]">
        {result.clusters.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: clusterColor(c.id) }} />
            {result.method === "lda" ? "주제" : "묶음"} {c.id + 1} ({c.terms.slice(0, 2).map((t) => t.term).join(", ")})
          </span>
        ))}
      </div>
    </div>
  );
}

function TermTable({ result, open }: { result: RunResult; open: (id: string) => void }) {
  const [docId, setDocId] = useState(result.docs[0]?.id);
  const d = result.docs.find((x) => x.id === docId) ?? result.docs[0];
  const isTfidf = result.method === "tfidf_kmeans";
  const max = Math.max(...(d?.topTerms.map((t) => t.weight) ?? [1]), 0.0001);
  if (!d) return null;
  return (
    <div className="space-y-3">
      <Think>
        {isTfidf ? (
          <>
            <b>TF</b>는 이 자료에 낱말이 나온 횟수, <b>IDF</b>는 다른 자료에 드물게 나올수록 커지는 값이에요. 둘을 곱한 <b>TF-IDF</b>가 높은 낱말이 이
            자료의 특징을 잘 보여 주나요? 이 숫자가 놓치는 맥락(누가, 왜 썼는지, 광고인지 등)은 무엇일까요?
          </>
        ) : (
          <>이 방법은 낱말 횟수(또는 문장 의미)를 바탕으로 해요. 자주 나온 낱말이 곧 그 자료의 핵심일까요?</>
        )}
      </Think>
      <div className="flex flex-wrap gap-1.5">
        {result.docs.map((x) => (
          <button
            key={x.id}
            onClick={() => setDocId(x.id)}
            className={clsx(
              "max-w-[16rem] truncate rounded-full border px-3 py-1 text-[13px]",
              x.id === d.id ? "border-primary bg-primary font-semibold text-on-primary" : "border-line-strong text-ink-2 hover:bg-paper-2",
            )}
          >
            {x.title}
          </button>
        ))}
      </div>
      <div className="card-sm overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-surface-2 text-left text-[13px] text-ink-2">
            <tr>
              <th className="px-3 py-2 font-semibold">낱말</th>
              <th className="px-3 py-2 text-right font-semibold">TF(횟수)</th>
              {isTfidf ? <th className="px-3 py-2 text-right font-semibold">IDF(드묾)</th> : null}
              <th className="px-3 py-2 font-semibold">{isTfidf ? "TF-IDF 점수" : "횟수"}</th>
            </tr>
          </thead>
          <tbody>
            {d.topTerms.map((t) => (
              <tr key={t.term} className="border-t border-line">
                <td className="px-3 py-1.5 font-medium">{t.term}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{t.tf}</td>
                {isTfidf ? <td className="px-3 py-1.5 text-right tabular-nums">{t.idf?.toFixed(2)}</td> : null}
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2 flex-1 rounded-full bg-paper-2">
                      <span className="block h-2 rounded-full bg-accent" style={{ width: `${(t.weight / max) * 100}%` }} />
                    </span>
                    <span className="w-12 text-right text-xs tabular-nums text-ink-3">{isTfidf ? t.weight.toFixed(3) : t.weight}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => open(d.id)} className="text-sm font-medium text-accent hover:underline">
        이 자료 원문 보기
      </button>
    </div>
  );
}

function Similarity({ result }: { result: RunResult }) {
  const n = result.docs.length;
  const [cell, setCell] = useState<[number, number] | null>(null);
  return (
    <div className="space-y-3">
      <Think>
        칸이 진할수록 두 자료가 {result.method === "bertopic" ? "의미가" : "낱말이"} 비슷해요. 가장 비슷하다고 나온 두 자료가 실제로도 같은 내용을 다루나요?
        내용이 겹친다면 둘 다 쓸 필요가 있을까요?
      </Think>
      <div className="card-sm overflow-x-auto p-3">
        <table className="border-separate border-spacing-0.5 text-xs">
          <thead>
            <tr>
              <th />
              {result.docs.map((d, j) => (
                <th key={d.id} className="h-8 w-9 font-semibold text-ink-3" title={d.title}>
                  {j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.docs.map((d, i) => (
              <tr key={d.id}>
                <th className="max-w-[12rem] truncate pr-2 text-left font-medium" title={d.title}>
                  {i + 1}. {d.title}
                </th>
                {result.similarity[i].map((v, j) => (
                  <td
                    key={j}
                    onMouseEnter={() => setCell([i, j])}
                    onMouseLeave={() => setCell(null)}
                    className="h-9 w-9 rounded-lg text-center tabular-nums"
                    style={{
                      background: i === j ? "var(--paper-2)" : `rgba(47, 91, 234, ${Math.max(0, Math.min(1, v)) * 0.9})`,
                      color: v > 0.55 && i !== j ? "#fff" : "var(--ink-2)",
                    }}
                  >
                    {i === j ? "" : v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="h-5 text-sm text-ink-2">
        {cell && cell[0] !== cell[1] && n
          ? `「${result.docs[cell[0]].title}」 ↔ 「${result.docs[cell[1]].title}」 비슷한 정도 ${result.similarity[cell[0]][cell[1]].toFixed(2)}`
          : ""}
      </p>
    </div>
  );
}

const TAG_LABEL: Record<string, string> = {
  NNG: "명사",
  NNP: "고유명사",
  NNB: "의존명사",
  VV: "동사",
  VA: "형용사",
  MAG: "부사",
  SL: "외국어",
  SN: "숫자",
  XR: "어근",
  JKS: "조사",
  JKO: "조사",
  JKB: "조사",
  JX: "조사",
  JKG: "조사",
  EF: "어미",
  EC: "어미",
  ETM: "어미",
  EP: "어미",
  SF: "문장부호",
};

export function MorphemeStrip({ morphemes }: { morphemes: Morpheme[] }) {
  return (
    <div className="flex flex-wrap gap-1 text-[13px] leading-none">
      {morphemes.map((m, i) => (
        <span
          key={i}
          title={TAG_LABEL[m.tag] ?? m.tag}
          className={clsx(
            "rounded-lg px-1.5 py-1",
            m.kept ? "bg-accent-soft font-semibold text-accent" : "bg-paper-2 text-ink-3 line-through decoration-ink-3/40",
          )}
        >
          {m.form}
        </span>
      ))}
    </div>
  );
}

function PreprocessResult({ result }: { result: RunResult }) {
  const [id, setId] = useState(result.preprocessing[0]?.id);
  const p = result.preprocessing.find((x) => x.id === id) ?? result.preprocessing[0];
  if (!p) return null;
  const s = p.stats;
  return (
    <div className="space-y-3">
      <Think>
        원문이 분석용 낱말로 바뀌면서 무엇이 빠졌나요? 파란 낱말만 분석에 쓰였어요. 빠지면 안 되는 낱말이 빠졌거나, 필요 없는 낱말이 남았다면 품사나
        불용어 조건을 바꿔 다시 분석해 보세요.
      </Think>
      <div className="flex flex-wrap gap-1.5">
        {result.preprocessing.map((x) => (
          <button
            key={x.id}
            onClick={() => setId(x.id)}
            className={clsx(
              "max-w-[16rem] truncate rounded-full border px-3 py-1 text-[13px]",
              x.id === p.id ? "border-primary bg-primary font-semibold text-on-primary" : "border-line-strong text-ink-2 hover:bg-paper-2",
            )}
          >
            {x.title}
          </button>
        ))}
      </div>
      <PreprocessStats stats={s} />
      <div className="card-sm p-4">
        <p className="mb-2 text-[13px] text-ink-3">앞부분 형태소 (마우스를 올리면 품사)</p>
        <MorphemeStrip morphemes={p.morphemes} />
      </div>
      <RemovedLists removed={p.removed} />
    </div>
  );
}

export function PreprocessStats({ stats: s }: { stats: RunResult["preprocessing"][number]["stats"] }) {
  const items = [
    ["원문 글자", s.chars],
    ["형태소", s.morphemes],
    ["품사로 뺌", s.removedByPos],
    ["불용어로 뺌", s.removedByStopword],
    ["짧아서 뺌", s.removedByLength],
    ["분석에 쓴 낱말", s.kept],
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map(([label, v], i) => (
        <div key={label} className={clsx("rounded-lg px-3 py-2", i === items.length - 1 ? "bg-accent-soft text-accent" : "bg-paper-2")}>
          <p className="text-[11px] text-ink-3">{label}</p>
          <p className="text-lg font-bold tabular-nums">{v.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

export function RemovedLists({ removed }: { removed: RunResult["preprocessing"][number]["removed"] }) {
  const groups = [
    ["품사 때문에 빠진 낱말", removed.pos],
    ["불용어라서 빠진 낱말", removed.stopword],
    ["너무 짧아서 빠진 낱말", removed.length],
  ] as const;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {groups.map(([label, list]) => (
        <div key={label} className="rounded-xl bg-paper-2/70 p-3">
          <p className="mb-2 text-[13px] font-semibold">{label}</p>
          {list.length ? (
            <p className="text-[13px] leading-relaxed text-ink-2">
              {list.map((w) => `${w.word}(${w.count})`).join(", ")}
            </p>
          ) : (
            <p className="text-[13px] text-ink-3">없음</p>
          )}
        </div>
      ))}
    </div>
  );
}
