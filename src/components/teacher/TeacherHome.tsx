"use client";

import { LogOut, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { ThemeToggle } from "../ThemeToggle";
import { Badge, Button, Card, Empty, Field, Input, Modal, Notice, Spinner } from "../ui";

type Classroom = {
  id: string;
  name: string;
  inviteCode: string;
  archived: boolean;
  createdAt: string;
  _count: { students: number; groups: number };
};

export function TeacherHome({ teacher }: { teacher: { name: string; email: string } }) {
  const router = useRouter();
  const [list, setList] = useState<Classroom[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [groupCount, setGroupCount] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ classrooms: Classroom[] }>("/api/teacher/classrooms").then((r) => setList(r.classrooms));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ classroom: Classroom }>("/api/teacher/classrooms", { method: "POST", json: { name, groupCount } });
      router.push(`/teacher/c/${r.classroom.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-accent">엮어 쓰기 · 교사</p>
          <h1 className="text-2xl font-bold">{teacher.name} 선생님의 학급</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> 학급 만들기
          </Button>
          <Button
            variant="ghost"
            aria-label="로그아웃"
            onClick={async () => {
              await api("/api/logout", { method: "POST" });
              router.replace("/teacher/login");
            }}
          >
            <LogOut size={16} />
          </Button>
        </div>
      </header>

      {!list ? (
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <Spinner /> 불러오는 중…
        </div>
      ) : list.length === 0 ? (
        <Empty title="아직 학급이 없어요" icon={<Users size={28} />}>
          학급을 만들면 학생에게 줄 초대 링크와 코드가 생겨요.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/teacher/c/${c.id}`}>
                <Card className="p-4 transition-shadow hover:shadow-[var(--shadow)]">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold">{c.name}</h2>
                    {c.archived ? <Badge>보관됨</Badge> : <Badge tone="accent">{c.inviteCode}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-3">
                    모둠 {c._count.groups}, 학생 {c._count.students}. {new Date(c.createdAt).toLocaleDateString("ko-KR")} 만듦
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="학급 만들기">
        <form onSubmit={create} className="space-y-4">
          <Field label="학급(수업) 이름">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 2학년 3반 국어" required maxLength={60} />
          </Field>
          <Field label="처음 만들 모둠 수" hint="나중에 더하거나 이름을 바꿀 수 있어요.">
            <Input type="number" min={0} max={20} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))} />
          </Field>
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              취소
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              만들기
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
