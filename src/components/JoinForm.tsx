"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button, Field, Input, Notice } from "./ui";

/**
 * 학생 입장 폼.
 * inline: 첫 화면용. 알약 입력 두 개와 먹색 알약 버튼이 한 줄.
 * 기본: 카드 안 세로 배치 (초대 링크·오류 화면).
 */
export function JoinForm({ initialCode, inline }: { initialCode?: string; inline?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/join", { method: "POST", json: { code, name } });
      router.push("/workspace");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  const codeInput = (
    <Input
      value={code}
      onChange={(e) => setCode(e.target.value.toUpperCase())}
      placeholder={inline ? "초대 코드" : "예: K7P2QX"}
      aria-label="초대 코드"
      autoCapitalize="characters"
      autoComplete="off"
      maxLength={10}
      className="font-mono tracking-[0.18em] uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
      required
    />
  );
  const nameInput = (
    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={inline ? "이름" : "예: 김하늘"} aria-label="이름" autoComplete="name" maxLength={20} required />
  );

  if (inline) {
    return (
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="w-[160px] shrink-0 grow sm:grow-0">{codeInput}</div>
          <div className="min-w-[160px] flex-1">{nameInput}</div>
          <Button type="submit" variant="primary" loading={loading} className="shrink-0">
            들어가기 {loading ? null : <ArrowUpRight size={16} />}
          </Button>
        </div>
        {error ? <Notice tone="bad">{error}</Notice> : <p className="text-[13px] text-ink-3">초대 코드는 선생님이 알려 줘요. 처음 쓴 이름을 똑같이 쓰면 이어서 할 수 있어요.</p>}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {initialCode ? null : (
        <Field label="초대 코드" hint="선생님이 알려 준 6자리 코드">
          {codeInput}
        </Field>
      )}
      <Field label="이름" hint="처음 들어올 때 쓴 이름을 똑같이 쓰면 이어서 할 수 있어요.">
        {nameInput}
      </Field>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Button type="submit" variant="primary" className="w-full" loading={loading}>
        들어가기
      </Button>
    </form>
  );
}
