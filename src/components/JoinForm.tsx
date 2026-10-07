"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button, Field, Input, Notice } from "./ui";

export function JoinForm({ initialCode }: { initialCode?: string }) {
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

  return (
    <form onSubmit={submit} className="space-y-4">
      {initialCode ? null : (
        <Field label="초대 코드" hint="선생님이 알려 준 6자리 코드">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: K7P2QX"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={10}
            className="font-mono tracking-[0.2em] uppercase"
            required
          />
        </Field>
      )}
      <Field label="이름" hint="처음 들어올 때 쓴 이름을 똑같이 쓰면 이어서 할 수 있어요.">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김하늘" autoComplete="name" maxLength={20} required />
      </Field>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Button type="submit" variant="primary" className="w-full" loading={loading}>
        들어가기
      </Button>
    </form>
  );
}
