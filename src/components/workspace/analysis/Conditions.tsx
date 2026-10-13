"use client";

import { ChevronDown, RotateCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { METHODS } from "@/lib/stages";
import { springs } from "../../motion";
import { Collapse, Field, Input, Segmented, clsx } from "../../ui";
import type { RunParams } from "../types";

export type Conditions = RunParams & { method: "tfidf_kmeans" | "lda" | "bertopic"; materialIds: string[] };

export const POS_OPTIONS = [
  { value: "nouns", label: "명사만", desc: "일반 명사와 고유 명사만 남겨요." },
  { value: "nouns_verbs", label: "명사+동사·형용사", desc: "'줄이다', '안전하다'처럼 움직임과 상태도 남겨요." },
  { value: "content", label: "내용어 전체", desc: "부사, 숫자, 외국어까지 남겨요." },
] as const;

type Props = { value: Conditions; onChange: (v: Conditions) => void };

/** 창 안의 소제목 한 줄 */
export function WinHeading({ title, desc, actions }: { title: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {desc ? <p className="mt-0.5 text-[12.5px] text-ink-3">{desc}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** 남길 낱말 종류 */
export function PosPicker({ value, onChange }: Props) {
  return (
    <div>
      <WinHeading title="남길 낱말 종류" desc={POS_OPTIONS.find((o) => o.value === value.preprocess.pos)?.desc} />
      <Segmented
        size="sm"
        value={value.preprocess.pos}
        onChange={(v) => onChange({ ...value, preprocess: { ...value.preprocess, pos: v } })}
        options={POS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />
    </div>
  );
}

/** 불용어: 분석에서 뺄 낱말 */
export function StopwordEditor({ value, onChange, defaultStopwords }: Props & { defaultStopwords: string[] }) {
  const [word, setWord] = useState("");
  const words = value.preprocess.stopwords;
  const set = (next: string[]) => onChange({ ...value, preprocess: { ...value.preprocess, stopwords: next } });

  function addWords(raw: string) {
    const add = raw
      .split(/[,\s]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (!add.length) return;
    set([...new Set([...words, ...add])]);
    setWord("");
  }

  return (
    <div>
      <WinHeading
        title={`불용어 ${words.length}개`}
        actions={
          <button type="button" onClick={() => set(defaultStopwords)} className="pressable inline-flex items-center gap-1 rounded-full bg-paper-2 px-3 py-1 text-[12.5px] font-medium text-ink-2 hover:bg-paper-3">
            <RotateCcw size={12} /> 기본값
          </button>
        }
      />
      <Input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addWords(word);
          }
        }}
        placeholder="뺄 낱말 넣기 (쉼표로 여러 개, Enter)"
        className="h-9 text-sm"
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {words.map((w) => (
          <span key={w} className="inline-flex items-center gap-1 rounded-full bg-paper-2 py-0.5 pl-2.5 pr-1 text-[12.5px]">
            {w}
            <button type="button" aria-label={`${w} 빼기`} onClick={() => set(words.filter((x) => x !== w))} className="rounded-full p-0.5 text-ink-3 hover:bg-paper-3 hover:text-bad">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

/** 묶기: 방법, 묶음 수, 자세한 조건 */
export function ClusterSettings({ value, onChange, methods }: Props & { methods: string[] }) {
  const [advanced, setAdvanced] = useState(false);
  const setMin = <K extends keyof RunParams["mining"]>(k: K, v: RunParams["mining"][K]) => onChange({ ...value, mining: { ...value.mining, [k]: v } });
  const isLda = value.method === "lda";

  return (
    <div className="space-y-5">
      <div>
        <WinHeading title="묶는 방법" />
        <div className="grid gap-2">
          {METHODS.filter((m) => methods.includes(m.key)).map((m) => {
            const on = value.method === m.key;
            return (
              <label key={m.key} className={clsx("pressable flex cursor-pointer gap-2.5 rounded-xl p-3", on ? "card-sm ring-2 ring-accent" : "bg-paper-2/70 hover:bg-paper-2")}>
                <input
                  type="radio"
                  name="method"
                  className="mt-1 accent-[var(--accent)]"
                  checked={on}
                  onChange={() => onChange({ ...value, method: m.key, mining: { ...value.mining, k: m.key === "tfidf_kmeans" ? value.mining.k : (value.mining.k ?? 3) } })}
                />
                <span>
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{m.desc}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <WinHeading title={isLda ? "주제 수" : "묶음 수"} desc={value.method === "tfidf_kmeans" ? "'자동'은 실루엣 점수가 가장 높은 수를 골라요." : "자료가 적을 때는 2~4개가 알맞아요."} />
        <div className="flex flex-wrap gap-1.5">
          {(value.method === "tfidf_kmeans" ? [null, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6]).map((k) => (
            <button
              type="button"
              key={String(k)}
              onClick={() => setMin("k", k)}
              aria-pressed={value.mining.k === k}
              className={clsx("pressable h-9 min-w-10 rounded-full px-3.5 text-sm font-medium", value.mining.k === k ? "bg-primary text-on-primary" : "bg-paper-2 text-ink-2 hover:bg-paper-3")}
            >
              {k ?? "자동"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <WinHeading
          title="자세한 조건"
          desc={[value.mining.minDf > 1 ? `최소 ${value.mining.minDf}자료` : "최소 1자료", value.mining.ngram === 2 ? "두 낱말까지" : "한 낱말"].join(", ")}
          actions={
            <button type="button" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced} className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-paper-2 text-ink-2 hover:bg-paper-3" aria-label="자세한 조건 펼치기">
              <motion.span animate={{ rotate: advanced ? 180 : 0 }} transition={springs.quick} className="flex">
                <ChevronDown size={15} />
              </motion.span>
            </button>
          }
        />
        <Collapse open={advanced}>
          <div className="space-y-4">
            <Field label="최소 등장 자료 수" hint="이보다 적은 자료에 나온 낱말은 빼요.">
              <Input type="number" min={1} max={10} value={value.mining.minDf} onChange={(e) => setMin("minDf", Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="h-9" />
            </Field>
            <div>
              <span className="mb-2 block text-sm font-semibold">낱말 단위</span>
              <Segmented
                size="sm"
                value={String(value.mining.ngram) as "1" | "2"}
                onChange={(v) => setMin("ngram", Number(v) as 1 | 2)}
                options={[
                  { value: "1", label: "한 낱말" },
                  { value: "2", label: "두 낱말까지" },
                ]}
              />
            </div>
          </div>
        </Collapse>
      </div>
    </div>
  );
}
