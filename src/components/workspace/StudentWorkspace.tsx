"use client";

import { Eye, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import { track } from "@/lib/client/logger";
import { Button, Card, Notice, Spinner } from "../ui";
import { GroupRoom, LiveProviders } from "./LiveProviders";
import { StageShell } from "./StageShell";
import type { Me } from "./types";

export function useMe(pollMs = 20000) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
      setError(null);
    } catch (e) {
      if (e instanceof ClientApiError && e.status === 401) router.replace("/");
      else setError((e as Error).message);
    }
  }, [router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 API에서 불러오기
    load();
    const t = setInterval(load, pollMs);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, pollMs]);
  return { me, error, reload: load };
}

export async function logout(router: ReturnType<typeof useRouter>) {
  track("auth.logout");
  await api("/api/logout", { method: "POST" });
  router.replace("/");
}

export function StudentWorkspace() {
  const router = useRouter();
  const { me, error, reload } = useMe();

  if (!me) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-ink-3">
        {error ? <Notice tone="bad">{error}</Notice> : (<><Spinner /> 불러오는 중…</>)}
      </div>
    );
  }

  if (!me.group) return <NoGroup me={me} onChosen={reload} />;

  const others = me.groups.filter((g) => g.id !== me.group!.id);

  return (
    <LiveProviders>
      <GroupRoom
        roomId={me.group.roomId}
        ctx={{
          me,
          viewer: { id: me.student.id, name: me.student.name, role: "student" },
          groupId: me.group.id,
          groupName: me.group.name,
          classroomId: me.classroom.id,
          members: me.members,
          writingMode: me.classroom.writingMode,
          canEdit: true,
          canComment: true,
          isOwnGroup: true,
        }}
      >
        <StageShell
          openStages={me.classroom.openStages}
          header={
            <div className="flex items-center gap-2">
              <div className="pill-bar flex h-10 min-w-0 items-center gap-2 pl-1.5 pr-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-on-primary">{me.group.name.replace(/모둠$/, "")}</span>
                <span className="truncate text-sm font-semibold">{me.group.name}</span>
                <span className="truncate text-[13px] text-ink-3 max-sm:hidden">{me.classroom.name}</span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                {me.classroom.allowPeerView && others.length ? (
                  <details className="relative">
                    <summary className="pressable flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 hover:bg-paper-2">
                      <Eye size={15} /> <span className="max-sm:hidden">다른 모둠</span>
                    </summary>
                    <div className="material-panel absolute right-0 z-30 mt-1.5 w-52 rounded-2xl p-1.5">
                      {others.map((g) => (
                        <Link key={g.id} href={`/workspace/peek/${g.id}`} className="block rounded-xl px-3 py-2 text-sm hover:bg-paper-2">
                          {g.name} <span className="text-xs text-ink-3">자료 {g.materials}</span>
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => logout(router)} aria-label="나가기" className="h-9 w-9 px-0">
                  <LogOut size={15} />
                </Button>
              </div>
            </div>
          }
        />
      </GroupRoom>
    </LiveProviders>
  );
}

function NoGroup({ me, onChosen }: { me: Me; onChosen: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function choose(id: string) {
    setBusy(id);
    try {
      await api("/api/me/group", { method: "POST", json: { groupId: id } });
      onChosen();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <p className="text-sm text-ink-3">{me.classroom.name}</p>
        <h1 className="mt-1 text-xl font-bold">{me.student.name}님, 반가워요</h1>
        {me.classroom.selfSelectGroup && me.groups.length ? (
          <>
            <p className="mb-4 mt-2 text-sm text-ink-2">함께할 모둠을 골라 주세요.</p>
            <div className="grid grid-cols-2 gap-2">
              {me.groups.map((g) => (
                <Button key={g.id} onClick={() => choose(g.id)} loading={busy === g.id} disabled={!!busy}>
                  {g.name} <span className="text-xs text-ink-3">{g.students}명</span>
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
            <Spinner /> 선생님이 모둠을 정해 주실 때까지 기다려 주세요. 정해지면 자동으로 넘어가요.
          </p>
        )}
        {error ? <Notice tone="bad" className="mt-3">{error}</Notice> : null}
        <button onClick={() => logout(router)} className="mt-6 text-[13px] text-ink-3 hover:text-ink">
          다른 이름으로 들어가기
        </button>
      </Card>
    </main>
  );
}
