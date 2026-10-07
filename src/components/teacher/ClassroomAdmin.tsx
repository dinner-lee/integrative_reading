"use client";

import { ArrowLeft, Check, Copy, Download, ExternalLink, Pencil, Plus, RefreshCw, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { METHODS, STAGES, WRITING_MODES, type WritingMode } from "@/lib/stages";
import { Badge, Button, Card, Notice, Spinner, clsx } from "../ui";

type Classroom = {
  id: string;
  name: string;
  inviteCode: string;
  openStages: string[];
  writingMode: WritingMode;
  allowPeerView: boolean;
  selfSelectGroup: boolean;
  enabledMethods: string[];
  archived: boolean;
};
type Group = { id: string; name: string; order: number };
type Student = { id: string; name: string; groupId: string | null; lastSeenAt: string };
type Progress = {
  id: string;
  name: string;
  students: { id: string; name: string }[];
  materials: number;
  runs: number;
  topic: string;
  adoptedRun: string | null;
  clusters: number;
  namedClusters: number;
  decisions: { selected: number; hold: number; excluded: number };
  outlineSections: number;
  outlinePlaced: number;
  draftChars: number;
  lastActivity: string | null;
};

const EXPORTS = [
  { type: "events", label: "활동 로그", ext: "CSV", desc: "단계 이동, 판단, 댓글, 편집 등 모든 기록" },
  { type: "materials", label: "수집 자료", ext: "CSV", desc: "자료 메타데이터와 본문, 변환 글자 수" },
  { type: "runs", label: "분석 기록", ext: "JSON", desc: "분석 조건과 전체 결과" },
  { type: "boards", label: "모둠 보드", ext: "JSON", desc: "계획, 묶음 이름·순서, 선정 근거, 개요" },
  { type: "drafts", label: "초고", ext: "CSV", desc: "글마다 가장 최근 스냅숏" },
  { type: "reflections", label: "성찰", ext: "CSV", desc: "학생별 성찰 답변" },
];

function ago(iso: string | null) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function ClassroomAdmin({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const [c, setC] = useState<Classroom | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [progress, setProgress] = useState<Progress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api<{ classroom: Classroom; groups: Group[]; students: Student[] }>(`/api/teacher/classrooms/${classroomId}`);
      setC(r.classroom);
      setGroups(r.groups);
      setStudents(r.students);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [classroomId]);

  const loadProgress = useCallback(async () => {
    try {
      const r = await api<{ groups: Progress[] }>(`/api/teacher/classrooms/${classroomId}/progress`);
      setProgress(r.groups);
    } catch {
      /* 진행 현황은 실패해도 관리 기능은 쓸 수 있게 */
    }
  }, [classroomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 알 수 있는 주소
    setOrigin(window.location.origin);
    load();
    loadProgress();
    const t = setInterval(() => {
      load();
      loadProgress();
    }, 30000);
    return () => clearInterval(t);
  }, [load, loadProgress]);

  async function patch(data: Partial<Classroom>) {
    if (!c) return;
    setC({ ...c, ...data });
    try {
      await api(`/api/teacher/classrooms/${classroomId}`, { method: "PATCH", json: data });
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  async function action(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
      loadProgress();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (!c) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-ink-3">
        {error ? <Notice tone="bad">{error}</Notice> : (<><Spinner /> 불러오는 중…</>)}
      </div>
    );
  }

  const link = `${origin}/join/${c.inviteCode}`;
  const unassigned = students.filter((s) => !s.groupId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/teacher" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> 학급 목록
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <button
          className="text-ink-3 hover:text-ink"
          aria-label="이름 바꾸기"
          onClick={() => {
            const name = prompt("학급 이름", c.name)?.trim();
            if (name) patch({ name });
          }}
        >
          <Pencil size={15} />
        </button>
        {c.archived ? <Badge>보관됨 · 학생 입장 불가</Badge> : null}
      </div>
      {error ? <Notice tone="bad" className="mb-4">{error}</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-3 font-bold">학생 초대</h2>
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-[#f1efe9] px-4 py-3 text-center">
              <p className="text-[11px] text-ink-3">초대 코드</p>
              <p className="font-mono text-3xl font-bold tracking-[0.18em]">{c.inviteCode}</p>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-[#fbfaf7] px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{link}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => copy(link, "link")}>
                  {copied === "link" ? <Check size={14} /> : <Copy size={14} />} 링크 복사
                </Button>
                <Button size="sm" onClick={() => copy(c.inviteCode, "code")}>
                  {copied === "code" ? <Check size={14} /> : <Copy size={14} />} 코드 복사
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    confirm("새 코드를 만들면 지금 코드와 링크로는 들어올 수 없어요(이미 들어온 학생은 괜찮아요). 바꿀까요?") &&
                    action(() => api(`/api/teacher/classrooms/${classroomId}/invite`, { method: "POST" }))
                  }
                >
                  <RefreshCw size={14} /> 새 코드
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-ink-3">학생은 이름만 쓰고 들어와요. 같은 이름을 쓰면 같은 학생으로 이어서 할 수 있어요.</p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-bold">단계 열기</h2>
          <p className="mb-3 text-[13px] text-ink-3">연 단계만 학생이 들어갈 수 있어요. 바꾸면 20초 안에 학생 화면에 반영돼요.</p>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s, i) => {
              const on = c.openStages.includes(s.key);
              return (
                <button
                  key={s.key}
                  aria-pressed={on}
                  onClick={() => patch({ openStages: on ? c.openStages.filter((x) => x !== s.key) : [...c.openStages, s.key] })}
                  className={clsx(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    on ? "border-ink bg-ink font-semibold text-white" : "border-line-strong bg-surface text-ink-2 hover:bg-[#f1efe9]",
                  )}
                >
                  {i + 1}. {s.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => patch({ openStages: STAGES.map((s) => s.key) })}>
              모두 열기
            </Button>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-bold">수업 설정</h2>
          <div>
            <p className="mb-1.5 text-sm font-semibold">표현하기 방식</p>
            <div className="space-y-1">
              {(Object.keys(WRITING_MODES) as WritingMode[]).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="radio" className="accent-[var(--accent)]" checked={c.writingMode === k} onChange={() => patch({ writingMode: k })} />
                  {WRITING_MODES[k]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold">학생에게 보일 분석 방법</p>
            <div className="space-y-1">
              {METHODS.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[var(--accent)]"
                    checked={c.enabledMethods.includes(m.key)}
                    onChange={(e) =>
                      patch({ enabledMethods: e.target.checked ? [...c.enabledMethods, m.key] : c.enabledMethods.filter((x) => x !== m.key) })
                    }
                  />
                  {m.label}
                  {m.key === "bertopic" ? <span className="text-xs text-ink-3">(분석 서버에 BERTopic 설치 필요)</span> : null}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" checked={c.allowPeerView} onChange={(e) => patch({ allowPeerView: e.target.checked })} />
            다른 모둠의 진행 상황 보기 허용 (읽기 전용)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" checked={c.selfSelectGroup} onChange={(e) => patch({ selfSelectGroup: e.target.checked })} />
            학생이 직접 모둠 고르기
          </label>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-bold">연구 자료 내보내기</h2>
          <p className="mb-3 text-[13px] text-ink-3">엑셀에서 바로 열 수 있는 CSV(UTF-8)와 원자료 JSON이에요.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {EXPORTS.map((e) => (
              <li key={e.type}>
                <a
                  href={`/api/teacher/classrooms/${classroomId}/export?type=${e.type}`}
                  className="flex h-full items-start gap-2 rounded-lg border border-line px-3 py-2 hover:bg-[#f6f5f0]"
                >
                  <Download size={15} className="mt-0.5 shrink-0 text-ink-3" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {e.label} <span className="text-xs font-normal text-ink-3">{e.ext}</span>
                    </span>
                    <span className="block text-xs text-ink-3">{e.desc}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">모둠 현황</h2>
          <Button size="sm" variant="ghost" onClick={loadProgress}>
            <RefreshCw size={14} /> 새로고침
          </Button>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#f6f5f0] text-left text-[13px] text-ink-2">
              <tr>
                <th className="px-3 py-2 font-semibold">모둠</th>
                <th className="px-3 py-2 font-semibold">화제</th>
                <th className="px-3 py-2 text-right font-semibold">자료</th>
                <th className="px-3 py-2 text-right font-semibold">분석</th>
                <th className="px-3 py-2 font-semibold">묶음 이름</th>
                <th className="px-3 py-2 font-semibold">선정·보류·제외</th>
                <th className="px-3 py-2 font-semibold">개요</th>
                <th className="px-3 py-2 text-right font-semibold">초고</th>
                <th className="px-3 py-2 font-semibold">최근 활동</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(progress ?? []).map((g) => (
                <tr key={g.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <p className="font-semibold">{g.name}</p>
                    <p className="text-xs text-ink-3">{g.students.map((s) => s.name).join(", ") || "학생 없음"}</p>
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-2">{g.topic || <span className="text-ink-3">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.materials}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.runs}</td>
                  <td className="px-3 py-2 tabular-nums">{g.clusters ? `${g.namedClusters}/${g.clusters}` : "—"}</td>
                  <td className="px-3 py-2">
                    <span className="flex gap-1">
                      <Badge tone="ok">{g.decisions.selected}</Badge>
                      <Badge tone="warn">{g.decisions.hold}</Badge>
                      <Badge tone="bad">{g.decisions.excluded}</Badge>
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {g.outlineSections}칸 · 자료 {g.outlinePlaced}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.draftChars.toLocaleString()}자</td>
                  <td className="px-3 py-2 text-ink-2">{ago(g.lastActivity)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/teacher/c/${classroomId}/g/${g.id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                      들어가 보기 <ExternalLink size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
              {progress && progress.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-ink-3">
                    모둠이 없어요. 아래에서 모둠을 만들어 주세요.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">모둠 편성</h2>
          <Button size="sm" onClick={() => action(() => api(`/api/teacher/classrooms/${classroomId}/groups`, { method: "POST", json: {} }))}>
            <Plus size={14} /> 모둠 더하기
          </Button>
        </div>
        {unassigned.length ? (
          <Card className="mb-4 border-warn/40 bg-warn-soft/40 p-4">
            <p className="mb-2 text-sm font-semibold">모둠이 없는 학생 {unassigned.length}명</p>
            <ul className="flex flex-wrap gap-2">
              {unassigned.map((s) => (
                <StudentChip key={s.id} s={s} groups={groups} action={action} />
              ))}
            </ul>
          </Card>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const members = students.filter((s) => s.groupId === g.id);
            return (
              <Card key={g.id} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold">
                    {g.name} <span className="text-sm font-normal text-ink-3">{members.length}명</span>
                  </h3>
                  <span className="flex">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="모둠 이름 바꾸기"
                      onClick={() => {
                        const name = prompt("모둠 이름", g.name)?.trim();
                        if (name) action(() => api(`/api/teacher/groups/${g.id}`, { method: "PATCH", json: { name } }));
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                    {members.length === 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="모둠 지우기"
                        onClick={() => confirm(`${g.name}을 지울까요?`) && action(() => api(`/api/teacher/groups/${g.id}`, { method: "DELETE" }))}
                      >
                        <Trash2 size={14} />
                      </Button>
                    ) : null}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {members.map((s) => (
                    <StudentChip key={s.id} s={s} groups={groups} action={action} />
                  ))}
                  {!members.length ? <li className="text-[13px] text-ink-3">아직 학생이 없어요.</li> : null}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-10 border-t border-line pt-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => patch({ archived: !c.archived })}>
            {c.archived ? "보관 풀기" : "수업 보관하기 (학생 입장 막기)"}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (prompt(`학급과 모든 자료·기록이 지워져요. 지우려면 학급 이름(${c.name})을 그대로 쓰세요.`) !== c.name) return;
              await api(`/api/teacher/classrooms/${classroomId}`, { method: "DELETE" });
              router.replace("/teacher");
            }}
          >
            <Trash2 size={15} /> 학급 지우기
          </Button>
        </div>
      </section>
    </main>
  );
}

function StudentChip({ s, groups, action }: { s: Student; groups: Group[]; action: (fn: () => Promise<unknown>) => void }) {
  return (
    <li className="flex items-center gap-1 rounded-lg border border-line bg-surface py-1 pl-2.5 pr-1 text-sm">
      <span className="font-medium" title={`마지막 접속 ${new Date(s.lastSeenAt).toLocaleString("ko-KR")}`}>
        {s.name}
      </span>
      <select
        value={s.groupId ?? ""}
        onChange={(e) => action(() => api(`/api/teacher/students/${s.id}`, { method: "PATCH", json: { groupId: e.target.value || null } }))}
        className="h-7 rounded border border-line-strong bg-surface px-1 text-[13px]"
        aria-label={`${s.name} 모둠`}
      >
        <option value="">모둠 없음</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => confirm(`${s.name} 학생을 학급에서 뺄까요? 이 학생이 올린 자료는 남아요.`) && action(() => api(`/api/teacher/students/${s.id}`, { method: "DELETE" }))}
        className="p-1 text-ink-3 hover:text-bad"
        aria-label={`${s.name} 빼기`}
      >
        <UserMinus size={14} />
      </button>
    </li>
  );
}
