"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { Card, Field, Notice, SectionTitle, Spinner, Textarea } from "../../ui";
import { useRoomCtx } from "../context";

export const REFLECTION_QUESTIONS = [
  { key: "compare", q: "분석이 만든 묶음과 우리가 최종으로 고른 자료는 어떻게 달랐나요? 왜 달랐을까요?" },
  { key: "conditions", q: "불용어나 묶음 수 같은 조건을 바꿨을 때 결과가 어떻게 달라졌나요? 그 까닭은 무엇이라고 생각하나요?" },
  { key: "limit", q: "낱말로는 비슷하다고 나왔지만 글의 목적·독자에 맞지 않았던 자료가 있었나요? 어떻게 판단했나요?" },
  { key: "peer", q: "다른 모둠의 글을 읽고 배운 점, 우리 글에서 고치고 싶은 점은 무엇인가요?" },
  { key: "role", q: "자료를 고를 때 텍스트 마이닝이 도와준 점과, 결국 사람이 판단해야 했던 점은 무엇인가요?" },
] as const;

export function ReflectStage() {
  const { me, canEdit, viewer } = useRoomCtx();
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const last = useRef("");

  useEffect(() => {
    if (viewer.role !== "student" || !canEdit) return;
    api<{ answers: Record<string, string> }>("/api/reflection").then((r) => {
      setAnswers(r.answers);
      last.current = JSON.stringify(r.answers);
    });
  }, [viewer.role, canEdit]);

  async function save() {
    if (!answers) return;
    const json = JSON.stringify(answers);
    if (json === last.current) return;
    setState("saving");
    try {
      await api("/api/reflection", { method: "PUT", json: { answers } });
      last.current = json;
      setState("saved");
    } catch {
      setState("error");
    }
  }

  if (viewer.role !== "student" || !canEdit) {
    return <Notice>성찰은 학생 각자가 자기 화면에서 써요.</Notice>;
  }

  const others = (me?.groups ?? []).filter((g) => g.id !== me?.group?.id);

  return (
    <div className="mx-auto max-w-4xl">
      <SectionTitle title="고쳐쓰기 · 성찰" desc="다른 모둠의 글을 읽어 보고, 우리 모둠의 글을 고친 뒤 자료를 고른 과정을 혼자 돌아봐요." />
      {me?.classroom.allowPeerView && others.length ? (
        <Card className="mb-5 p-4">
          <h3 className="mb-2 font-bold">다른 모둠 글 읽기</h3>
          <div className="flex flex-wrap gap-2">
            {others.map((g) => (
              <Link
                key={g.id}
                href={`/workspace/peek/${g.id}?stage=write`}
                className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper-2"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
      {!answers ? (
        <div className="flex items-center gap-2 py-8 text-sm text-ink-3">
          <Spinner /> 불러오는 중…
        </div>
      ) : (
        <Card className="space-y-5 p-5">
          {REFLECTION_QUESTIONS.map((x, i) => (
            <Field key={x.key} label={`${i + 1}. ${x.q}`}>
              <Textarea
                rows={4}
                value={answers[x.key] ?? ""}
                onChange={(e) => {
                  setAnswers({ ...answers, [x.key]: e.target.value });
                  setState("idle");
                }}
                onBlur={save}
                maxLength={5000}
              />
            </Field>
          ))}
          <p className="text-right text-[13px] text-ink-3" aria-live="polite">
            {state === "saving" ? "저장하는 중…" : state === "saved" ? "저장했어요" : state === "error" ? "저장하지 못했어요. 다시 시도해 주세요." : "칸을 벗어나면 저장돼요."}
          </p>
        </Card>
      )}
    </div>
  );
}
