"use client";

import { RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { METHODS } from "@/lib/stages";
import { Field, Input, Segmented, clsx } from "../../ui";
import type { Material, RunParams } from "../types";

export type Conditions = RunParams & { method: "tfidf_kmeans" | "lda" | "bertopic"; materialIds: string[] };

export const POS_OPTIONS = [
  { value: "nouns", label: "명사만", desc: "일반 명사와 고유 명사만 남겨요." },
  { value: "nouns_verbs", label: "명사+동사·형용사", desc: "'줄이다', '안전하다'처럼 움직임과 상태도 남겨요." },
  { value: "content", label: "내용어 전체", desc: "부사, 숫자, 외국어까지 남겨요." },
] as const;

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

  return (
    <fieldset disabled={disabled} className="space-y-5">
      <div>
        <span className="mb-1.5 block text-sm font-semibold">분석 방법</span>
        <div className="space-y-1.5">
          {METHODS.filter((m) => methods.includes(m.key)).map((m) => (
            <label
              key={m.key}
              className={clsx(
                "flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2",
                value.method === m.key ? "border-accent bg-accent-soft/50" : "border-line hover:bg-surface-2",
              )}
            >
              <input type="radio" name="method" className="mt-1 accent-[var(--accent)]" checked={value.method === m.key} onChange={() => set("method", m.key)} />
              <span>
                <span className="block text-sm font-semibold">{m.label}</span>
                {value.method === m.key ? <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{m.desc}</span> : null}
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
                "h-8 min-w-10 rounded-lg border px-2 text-sm",
                value.mining.k === k ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface hover:bg-paper-2",
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
          <span className="text-sm font-semibold">불용어(분석에서 뺄 낱말) {value.preprocess.stopwords.length}개</span>
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
        <div className="mt-1.5 flex gap-1.5">
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
            className="h-8 text-sm"
          />
        </div>
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
      <p className="sr-only">{method.desc}</p>
    </fieldset>
  );
}
