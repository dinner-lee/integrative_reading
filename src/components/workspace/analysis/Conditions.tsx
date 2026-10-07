"use client";

import { ChevronDown, RotateCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { METHODS } from "@/lib/stages";
import { springs } from "../../motion";
import { Collapse, Field, Input, Section, Sections, Segmented, clsx } from "../../ui";
import type { Material, RunParams } from "../types";

export type Conditions = RunParams & { method: "tfidf_kmeans" | "lda" | "bertopic"; materialIds: string[] };

export const POS_OPTIONS = [
  { value: "nouns", label: "명사만", desc: "일반 명사와 고유 명사만 남겨요." },
  { value: "nouns_verbs", label: "명사+동사·형용사", desc: "'줄이다', '안전하다'처럼 움직임과 상태도 남겨요." },
  { value: "content", label: "내용어 전체", desc: "부사, 숫자, 외국어까지 남겨요." },
] as const;

type PanelProps = {
  value: Conditions;
  onChange: (v: Conditions) => void;
  disabled?: boolean;
};

/** ① 자료 고르기·전처리: 분석에 넣을 자료, 남길 낱말 종류, 불용어 */
export function PreprocessPanel({ value, onChange, materials, defaultStopwords, disabled }: PanelProps & { materials: Material[]; defaultStopwords: string[] }) {
  const [word, setWord] = useState("");
  const set = <K extends keyof Conditions>(k: K, v: Conditions[K]) => onChange({ ...value, [k]: v });
  const setPre = <K extends keyof RunParams["preprocess"]>(k: K, v: RunParams["preprocess"][K]) =>
    onChange({ ...value, preprocess: { ...value.preprocess, [k]: v } });
  const chosen = new Set(value.materialIds);

  function addWords(raw: string) {
    const words = raw
      .split(/[,\s]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (!words.length) return;
    setPre("stopwords", [...new Set([...value.preprocess.stopwords, ...words])]);
    setWord("");
  }

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <Sections>
        <Section
          title={`분석에 넣을 자료 ${value.materialIds.length}/${materials.length}`}
          desc="어떤 자료를 넣고 빼느냐에 따라서도 결과가 달라져요."
          actions={
            <button
              type="button"
              className="pressable rounded-full bg-paper-2 px-3.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-paper-3"
              onClick={() => set("materialIds", chosen.size === materials.length ? [] : materials.map((m) => m.id))}
            >
              {chosen.size === materials.length ? "모두 빼기" : "모두 넣기"}
            </button>
          }
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {materials.map((m) => {
              const on = chosen.has(m.id);
              return (
                <li key={m.id}>
                  <label className={clsx("pressable flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm", on ? "card-sm" : "bg-paper-2/70 text-ink-2")}>
                    <input
                      type="checkbox"
                      className="accent-[var(--accent)]"
                      checked={on}
                      onChange={(e) => set("materialIds", e.target.checked ? [...value.materialIds, m.id] : value.materialIds.filter((x) => x !== m.id))}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                    <span className="shrink-0 text-xs text-ink-3">{m.content.length.toLocaleString()}자</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="남길 낱말 종류" desc={POS_OPTIONS.find((o) => o.value === value.preprocess.pos)?.desc}>
          <Segmented value={value.preprocess.pos} onChange={(v) => setPre("pos", v)} options={POS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Section>

        <Section
          title={`불용어 ${value.preprocess.stopwords.length}개`}
          desc="분석에서 뺄 낱말이에요. 결과를 본 뒤 여기서 낱말을 더 빼고 다시 묶을 수 있어요."
          actions={
            <button type="button" onClick={() => setPre("stopwords", defaultStopwords)} className="pressable inline-flex items-center gap-1 rounded-full bg-paper-2 px-3.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-paper-3">
              <RotateCcw size={13} /> 기본값
            </button>
          }
        >
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
            {value.preprocess.stopwords.map((w) => (
              <span key={w} className="inline-flex items-center gap-1 rounded-full bg-paper-2 py-1 pl-3 pr-1.5 text-[13px]">
                {w}
                <button type="button" aria-label={`${w} 빼기`} onClick={() => setPre("stopwords", value.preprocess.stopwords.filter((x) => x !== w))} className="rounded-full p-0.5 text-ink-3 hover:bg-paper-3 hover:text-bad">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 max-w-sm">
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
            />
          </div>
        </Section>
      </Sections>
    </fieldset>
  );
}

/** ② 묶기: 방법, 묶음 수, 자세한 조건 */
export function ClusterPanel({ value, onChange, methods, disabled }: PanelProps & { methods: string[] }) {
  const [advanced, setAdvanced] = useState(false);
  const set = <K extends keyof Conditions>(k: K, v: Conditions[K]) => onChange({ ...value, [k]: v });
  const setMin = <K extends keyof RunParams["mining"]>(k: K, v: RunParams["mining"][K]) =>
    onChange({ ...value, mining: { ...value.mining, [k]: v } });
  const isLda = value.method === "lda";
  const advancedSummary = [value.mining.minDf > 1 ? `최소 ${value.mining.minDf}자료` : "최소 1자료", value.mining.ngram === 2 ? "두 낱말까지" : "한 낱말"].join(", ");

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <Sections>
        <Section title="묶는 방법" desc="방법마다 자료를 숫자로 바꾸는 방식이 달라요. 바꿔 가며 결과를 비교해 보세요.">
          <div className="grid gap-2 lg:grid-cols-3">
            {METHODS.filter((m) => methods.includes(m.key)).map((m) => {
              const on = value.method === m.key;
              return (
                <label key={m.key} className={clsx("pressable flex cursor-pointer gap-3 rounded-2xl p-4", on ? "card-sm ring-2 ring-accent" : "bg-paper-2/70 hover:bg-paper-2")}>
                  <input type="radio" name="method" className="mt-1 accent-[var(--accent)]" checked={on} onChange={() => set("method", m.key)} />
                  <span>
                    <span className="block text-[15px] font-semibold">{m.label}</span>
                    <span className="mt-1 block text-[13px] leading-snug text-ink-2">{m.desc}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </Section>

        <Section title={isLda ? "주제 수" : "묶음 수"} desc={value.method === "tfidf_kmeans" ? "'자동'은 실루엣 점수가 가장 높은 수를 골라요. 글에 필요한 하위 주제 수와 같지 않을 수 있어요." : "자료가 적을 때는 2~4개가 알맞아요."}>
          <div className="flex flex-wrap gap-1.5">
            {(value.method === "tfidf_kmeans" ? [null, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6]).map((k) => (
              <button
                type="button"
                key={String(k)}
                onClick={() => setMin("k", k)}
                aria-pressed={value.mining.k === k}
                className={clsx(
                  "pressable h-10 min-w-12 rounded-full px-4 text-sm font-medium",
                  value.mining.k === k ? "bg-primary text-on-primary" : "bg-paper-2 text-ink-2 hover:bg-paper-3",
                )}
              >
                {k ?? "자동"}
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="자세한 조건"
          desc={advancedSummary}
          actions={
            <button type="button" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced} className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-ink-2 hover:bg-paper-3" aria-label="자세한 조건 펼치기">
              <motion.span animate={{ rotate: advanced ? 180 : 0 }} transition={springs.quick} className="flex">
                <ChevronDown size={16} />
              </motion.span>
            </button>
          }
        >
          <Collapse open={advanced}>
            <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
              <Field label="최소 등장 자료 수" hint="이보다 적은 자료에 나온 낱말은 빼요.">
                <Input type="number" min={1} max={10} value={value.mining.minDf} onChange={(e) => setMin("minDf", Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
              </Field>
              <div>
                <span className="mb-2 block text-[15px] font-semibold">낱말 단위</span>
                <Segmented
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
        </Section>
      </Sections>
    </fieldset>
  );
}
