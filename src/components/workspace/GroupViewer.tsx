"use client";

import { MenuSection } from "../SettingsMenu";
import { ThemeToggle } from "../ThemeToggle";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { setLogClassroom } from "@/lib/client/logger";
import { STAGE_KEYS } from "@/lib/stages";
import { Badge, Notice, Spinner } from "../ui";
import { GroupRoom, LiveProviders } from "./LiveProviders";
import { StageShell } from "./StageShell";
import { useMe } from "./StudentWorkspace";
import type { Me } from "./types";

type GroupInfo = {
  group: { id: string; name: string; roomId: string };
  classroom: { id: string; name: string; writingMode: Me["classroom"]["writingMode"] };
  members: { id: string; name: string }[];
};

function useGroupInfo(groupId: string) {
  const [info, setInfo] = useState<GroupInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<GroupInfo>(`/api/groups/${groupId}`).then(setInfo).catch((e) => setError((e as Error).message));
  }, [groupId]);
  return { info, error };
}

function Loading({ error }: { error: string | null }) {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-2 px-4 text-sm text-ink-3">
      {error ? <Notice tone="bad">{error}</Notice> : (<><Spinner /> 불러오는 중…</>)}
    </div>
  );
}

/** 학생: 다른 모둠 둘러보기 (읽기 전용) */
export function PeerViewer({ groupId, initialStage }: { groupId: string; initialStage?: string }) {
  const { me } = useMe(60000);
  const { info, error } = useGroupInfo(groupId);
  if (!me || !info) return <Loading error={error} />;
  return (
    <LiveProviders>
      <GroupRoom
        roomId={info.group.roomId}
        ctx={{
          me,
          viewer: { id: me.student.id, name: me.student.name, role: "student" },
          groupId,
          groupName: info.group.name,
          classroomId: info.classroom.id,
          members: info.members,
          writingMode: info.classroom.writingMode,
          canEdit: false,
          canComment: false,
          isOwnGroup: false,
        }}
      >
        <StageShell
          openStages={me.classroom.openStages.filter((s) => s !== "reflect")}
          hideStages={["reflect"]}
          initialStage={initialStage}
          title={info.classroom.name}
          badge={
            <>
              <span className="text-[13px] text-ink-3">{info.group.name} 둘러보기</span>
              <Badge>읽기 전용</Badge>
            </>
          }
          back={{ href: "/workspace", label: "우리 모둠으로" }}
          settings={
            <>
              <MenuSection title="보고 있는 모둠">
                <p className="px-1 py-1 text-sm">
                  {info.group.name} <span className="text-ink-3">({info.members.map((m) => m.name).join(", ") || "학생 없음"})</span>
                </p>
              </MenuSection>
              <MenuSection title="화면 모드">
                <div className="px-1 py-1">
                  <ThemeToggle />
                </div>
              </MenuSection>
            </>
          }
        />
      </GroupRoom>
    </LiveProviders>
  );
}

/** 교사: 모둠 공간 보기 (내용은 읽기 전용, 댓글로 안내 가능) */
export function TeacherGroupViewer({ groupId, teacher }: { groupId: string; teacher: { id: string; name: string } }) {
  const { info, error } = useGroupInfo(groupId);
  useEffect(() => {
    if (info) setLogClassroom(info.classroom.id);
  }, [info]);
  if (!info) return <Loading error={error} />;
  return (
    <LiveProviders>
      <GroupRoom
        roomId={info.group.roomId}
        ctx={{
          me: null,
          viewer: { id: teacher.id, name: teacher.name, role: "teacher" },
          groupId,
          groupName: info.group.name,
          classroomId: info.classroom.id,
          members: info.members,
          writingMode: info.classroom.writingMode,
          canEdit: false,
          canComment: true,
          isOwnGroup: false,
        }}
      >
        <StageShell
          openStages={STAGE_KEYS}
          hideStages={["reflect"]}
          title={info.classroom.name}
          badge={
            <>
              <span className="text-[13px] text-ink-3">{info.group.name}</span>
              <Badge tone="accent">교사 보기</Badge>
            </>
          }
          back={{ href: `/teacher/c/${info.classroom.id}`, label: "학급 관리로" }}
          settings={
            <>
              <MenuSection title="모둠원">
                <p className="px-1 py-1 text-sm">{info.members.map((m) => m.name).join(", ") || "학생 없음"}</p>
                <p className="px-1 pb-1 text-[13px] text-ink-3">내용은 읽기 전용이고 댓글은 남길 수 있어요.</p>
              </MenuSection>
              <MenuSection title="화면 모드">
                <div className="px-1 py-1">
                  <ThemeToggle />
                </div>
              </MenuSection>
            </>
          }
        />
      </GroupRoom>
    </LiveProviders>
  );
}
