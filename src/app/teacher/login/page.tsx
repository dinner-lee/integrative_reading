"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Notice, Segmented } from "@/components/ui";
import { api } from "@/lib/client/api";

export default function TeacherLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "", signupCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api(mode === "login" ? "/api/teacher/login" : "/api/teacher/signup", { method: "POST", json: form });
      router.push("/teacher");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-[var(--radius-panel)] border border-line bg-surface p-7 shadow-card sm:p-8">
        <Link href="/" className="text-sm font-semibold text-accent">
          엮어 쓰기
        </Link>
        <h1 className="mb-4 mt-1 text-xl font-bold">교사 화면</h1>
        <div className="mb-5">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "login", label: "로그인" },
              { value: "signup", label: "처음 가입" },
            ]}
          />
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" ? (
            <Field label="이름">
              <Input value={form.name} onChange={set("name")} autoComplete="name" required />
            </Field>
          ) : null}
          <Field label="이메일">
            <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
          </Field>
          <Field label="비밀번호" hint={mode === "signup" ? "8자 이상" : undefined}>
            <Input
              type="password"
              value={form.password}
              onChange={set("password")}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </Field>
          {mode === "signup" ? (
            <Field label="교사 가입 코드" hint="관리자가 정한 코드가 있을 때만 적어요.">
              <Input value={form.signupCode} onChange={set("signupCode")} autoComplete="off" />
            </Field>
          ) : null}
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Button type="submit" variant="primary" className="w-full" loading={loading}>
            {mode === "login" ? "로그인" : "가입하고 시작하기"}
          </Button>
        </form>
      </div>
    </main>
  );
}
