"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
          header={
            <div className="flex items-center gap-2">
              <Link href="/workspace" className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-ink-2 hover:bg-[#efede6]">
                <ArrowLeft size={15} /> 우리 모둠
              </Link>
              <p className="truncate text-sm font-bold">{info.group.name} 둘러보기</p>
              <Badge>읽기 전용</Badge>
            </div>
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
          header={
            <div className="flex items-center gap-2">
              <Link href={`/teacher/c/${info.classroom.id}`} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-ink-2 hover:bg-[#efede6]">
                <ArrowLeft size={15} /> {info.classroom.name}
              </Link>
              <p className="truncate text-sm font-bold">{info.group.name}</p>
              <span className="truncate text-[13px] text-ink-3">{info.members.map((m) => m.name).join(", ")}</span>
              <Badge tone="accent">교사 보기 · 댓글 가능</Badge>
            </div>
          }
        />
      </GroupRoom>
    </LiveProviders>
  );
}
