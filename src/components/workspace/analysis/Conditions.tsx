"use client";

import { ChevronDown, RotateCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { METHODS } from "@/lib/stages";
import { springs } from "../../motion";
import { Collapse, Field, Input, Segmented, clsx } from "../../ui";
import type { Material, RunParams } from "../types";

export type Conditions = RunParams & { method: "tfidf_kmeans" | "lda" | "bertopic"; materialIds: string[] };

export const POS_OPTIONS = [
  { value: "nouns", label: "명사만", desc: "일반 명사와 고유 명사만 남겨요." },
  { value: "nouns_verbs", label: "명사+동사·형용사", desc: "'줄이다', '안전하다'처럼 움직임과 상태도 남겨요." },
  { value: "content", label: "내용어 전체", desc: "부사, 숫자, 외국어까지 남겨요." },
] as const;

/**
 * 분석 조건. 자주 쓰는 것(방법·묶음 수·품사·자료)을 먼저 보이고,
 * 불용어 편집·최소 등장 수·낱말 단위는 한 단계 아래에 둔다.
 */
export function ConditionsPanel({
  value,
  onChange,
  methods,
  materials,
  defaultStopwords,
  disabled,
}: {
  value: Conditions;
  onChange: (v: Conditions) => void;
  methods: string[];
  materials: Material[];
  defaultStopwords: string[];
  disabled?: boolean;
}) {
  const [word, setWord] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const set = <K extends keyof Conditions>(k: K, v: Conditions[K]) => onChange({ ...value, [k]: v });
  const setPre = <K extends keyof RunParams["preprocess"]>(k: K, v: RunParams["preprocess"][K]) =>
    onChange({ ...value, preprocess: { ...value.preprocess, [k]: v } });
  const setMin = <K extends keyof RunParams["mining"]>(k: K, v: RunParams["mining"][K]) =>
    onChange({ ...value, mining: { ...value.mining, [k]: v } });

  function addWords(raw: string) {
    const words = raw
      .split(/[,\s]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (!words.length) return;
    setPre("stopwords", [...new Set([...value.preprocess.stopwords, ...words])]);
    setWord("");
  }

  const method = METHODS.find((m) => m.key === value.method)!;
  const isLda = value.method === "lda";
  const chosen = new Set(value.materialIds);
  const stopDiff = value.preprocess.stopwords.length - defaultStopwords.length;
  const advancedSummary = [
    `불용어 ${value.preprocess.stopwords.length}개${stopDiff ? ` (기본값${stopDiff > 0 ? "+" : ""}${stopDiff})` : ""}`,
    value.mining.minDf > 1 ? `최소 ${value.mining.minDf}자료` : null,
    value.mining.ngram === 2 ? "두 낱말까지" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <fieldset disabled={disabled} className="space-y-5">
      <div>
        <span className="mb-1.5 block text-sm font-semibold">분석 방법</span>
        <div className="space-y-1.5">
          {METHODS.filter((m) => methods.includes(m.key)).map((m) => (
            <label
              key={m.key}
              className={clsx(
                "pressable flex cursor-pointer gap-2.5 rounded-2xl border px-3 py-2.5",
                value.method === m.key ? "border-ink/60 bg-paper-2/70" : "border-line hover:bg-surface-2",
              )}
            >
              <input type="radio" name="method" className="mt-1 accent-[var(--accent)]" checked={value.method === m.key} onChange={() => set("method", m.key)} />
              <span>
                <span className="block text-sm font-semibold">{m.label}</span>
                <Collapse open={value.method === m.key}>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{m.desc}</span>
                </Collapse>
              </span>
            </label>
          ))}
        </div>
      </div>

      <Field label={isLda ? "주제 수" : "묶음 수"} hint={value.method === "tfidf_kmeans" ? "'자동'은 실루엣 점수가 가장 높은 수를 골라요." : undefined}>
        <div className="flex flex-wrap gap-1">
          {(value.method === "tfidf_kmeans" ? [null, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6]).map((k) => (
            <button
              type="button"
              key={String(k)}
              onClick={() => setMin("k", k)}
              aria-pressed={value.mining.k === k}
              className={clsx(
                "pressable h-8 min-w-10 rounded-full border px-3 text-sm",
                value.mining.k === k ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:bg-paper-2",
              )}
            >
              {k ?? "자동"}
            </button>
          ))}
        </div>
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">남길 낱말 종류(품사)</span>
        <Segmented
          size="sm"
          value={value.preprocess.pos}
          onChange={(v) => setPre("pos", v)}
          options={POS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <p className="mt-1 text-[13px] text-ink-3">{POS_OPTIONS.find((o) => o.value === value.preprocess.pos)?.desc}</p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold">
            분석에 넣을 자료 {value.materialIds.length}/{materials.length}
          </span>
          <button
            type="button"
            className="text-[13px] text-ink-3 hover:text-ink"
            onClick={() => set("materialIds", chosen.size === materials.length ? [] : materials.map((m) => m.id))}
          >
            {chosen.size === materials.length ? "모두 빼기" : "모두 넣기"}
          </button>
        </div>
        <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1.5">
          {materials.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={chosen.has(m.id)}
                  onChange={(e) =>
                    set("materialIds", e.target.checked ? [...value.materialIds, m.id] : value.materialIds.filter((x) => x !== m.id))
                  }
                />
                <span className="truncate">{m.title}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[13px] text-ink-3">어떤 자료를 넣고 빼느냐에 따라서도 결과가 달라져요.</p>
      </div>

      <div className="rounded-lg border border-line">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="pressable flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-surface-2"
        >
          <span>
            <span className="block text-sm font-semibold">자세한 조건</span>
            <span className="block text-[13px] text-ink-3">{advancedSummary}</span>
          </span>
          <motion.span animate={{ rotate: advanced ? 180 : 0 }} transition={springs.quick} className="text-ink-3">
            <ChevronDown size={16} />
          </motion.span>
        </button>
        <Collapse open={advanced}>
          <div className="space-y-4 border-t border-line px-3 py-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold">불용어(분석에서 뺄 낱말)</span>
                <button
                  type="button"
                  onClick={() => setPre("stopwords", defaultStopwords)}
                  className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
                >
                  <RotateCcw size={13} /> 기본값
                </button>
              </div>
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-lg border border-line bg-surface-2 p-2">
                {value.preprocess.stopwords.map((w) => (
                  <span key={w} className="inline-flex items-center gap-0.5 rounded-lg bg-surface px-1.5 py-0.5 text-[13px] ring-1 ring-line">
                    {w}
                    <button
                      type="button"
                      aria-label={`${w} 빼기`}
                      onClick={() => setPre("stopwords", value.preprocess.stopwords.filter((x) => x !== w))}
                      className="text-ink-3 hover:text-bad"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addWords(word);
                  }
                }}
                placeholder="낱말 넣기 (쉼표로 여러 개)"
                className="mt-1.5 h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="최소 등장 자료 수" hint="이보다 적은 자료에 나온 낱말은 빼요.">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={value.mining.minDf}
                  onChange={(e) => setMin("minDf", Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="h-8"
                />
              </Field>
              <Field label="낱말 단위">
                <Segmented
                  size="sm"
                  value={String(value.mining.ngram) as "1" | "2"}
                  onChange={(v) => setMin("ngram", Number(v) as 1 | 2)}
                  options={[
                    { value: "1", label: "한 낱말" },
                    { value: "2", label: "두 낱말까지" },
                  ]}
                />
              </Field>
            </div>
          </div>
        </Collapse>
      </div>
      <p className="sr-only">{method.desc}</p>
    </fieldset>
  );
}
