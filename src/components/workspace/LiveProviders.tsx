"use client";

import { LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense";
import { ClientSideSuspense } from "@liveblocks/react";
import { LiveblocksUiConfig } from "@liveblocks/react-ui";
import type { ReactNode } from "react";
import { Spinner } from "../ui";
import { RoomCtxProvider, type RoomCtx } from "./context";
import { initialStorage } from "./storage";

/** 댓글 UI 한국어 문구 */
const KO = {
  locale: "ko",
  USER_SELF: "나",
  USER_UNKNOWN: "알 수 없음",
  COMPOSER_PLACEHOLDER: "의견을 남겨 보세요",
  COMPOSER_SEND: "보내기",
  COMPOSER_INSERT_EMOJI: "이모지",
  COMPOSER_INSERT_MENTION: "사람 부르기",
  COMPOSER_ATTACH_FILES: "파일 붙이기",
  THREAD_COMPOSER_PLACEHOLDER: "답글 쓰기",
  THREAD_COMPOSER_SEND: "답글",
  THREAD_RESOLVE: "해결됨으로 표시",
  THREAD_UNRESOLVE: "다시 열기",
  THREAD_SUBSCRIBE: "알림 받기",
  THREAD_UNSUBSCRIBE: "알림 끄기",
  THREAD_NEW_INDICATOR: "새 댓글",
  THREAD_NEW_INDICATOR_DESCRIPTION: "읽지 않은 새 댓글",
  COMMENT_EDITED: "(고침)",
  COMMENT_DELETED: "지운 댓글이에요.",
  COMMENT_MORE: "더 보기",
  COMMENT_EDIT: "고치기",
  COMMENT_DELETE: "지우기",
  COMMENT_ADD_REACTION: "반응 남기기",
  COMMENT_EDIT_COMPOSER_PLACEHOLDER: "댓글 고치기",
  COMMENT_EDIT_COMPOSER_CANCEL: "취소",
  COMMENT_EDIT_COMPOSER_SAVE: "저장",
  EMOJI_PICKER_SEARCH_PLACEHOLDER: "찾기",
  EMOJI_PICKER_EMPTY: "찾는 이모지가 없어요",
  EMOJI_PICKER_ERROR: () => "이모지를 불러오지 못했어요",
  EMOJI_PICKER_CHANGE_SKIN_TONE: "피부색 바꾸기",
  COPY_TO_CLIPBOARD: "복사",
  THREAD_SHOW_MORE_COMMENTS: (count: number) => `댓글 ${count}개 더 보기`,
  LIST_REMAINING: (count: number) => `외 ${count}명`,
  LIST_REMAINING_USERS: (count: number) => `외 ${count}명`,
  LIST_REMAINING_COMMENTS: (count: number) => `외 댓글 ${count}개`,
};

export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      baseUrl={process.env.NEXT_PUBLIC_LIVEBLOCKS_BASE_URL || undefined}
      throttle={50}
      badgeLocation="bottom-left"
      resolveUsers={async ({ userIds }) => {
        const qs = userIds.map((id) => `userIds=${encodeURIComponent(id)}`).join("&");
        const res = await fetch(`/api/users?${qs}`);
        return res.ok ? res.json() : userIds.map(() => undefined);
      }}
    >
      <LiveblocksUiConfig overrides={KO}>{children}</LiveblocksUiConfig>
    </LiveblocksProvider>
  );
}

export function GroupRoom({ roomId, ctx, children }: { roomId: string; ctx: RoomCtx; children: ReactNode }) {
  return (
    <RoomProvider id={roomId} initialPresence={{ stage: null, focus: null }} initialStorage={initialStorage}>
      <RoomCtxProvider value={ctx}>
        <ClientSideSuspense
          fallback={
            <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-ink-3">
              <Spinner /> 모둠 공간에 연결하는 중…
            </div>
          }
        >
          {children}
        </ClientSideSuspense>
      </RoomCtxProvider>
    </RoomProvider>
  );
}
