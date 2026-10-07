"use client";

import { useThreads } from "@liveblocks/react/suspense";
import { Composer, Thread } from "@liveblocks/react-ui";
import { MessageCircle } from "lucide-react";
import { track } from "@/lib/client/logger";
import { useRoomCtx } from "./context";

/** 묶음·개요 칸 등 대상별 논의 댓글 (답글 가능) */
export function Discussion({ stage, target, placeholder }: { stage: string; target: string; placeholder?: string }) {
  const { canComment } = useRoomCtx();
  const { threads } = useThreads({ query: { metadata: { stage, target } } });
  return (
    <div className="space-y-2">
      {threads.map((t) => (
        <Thread key={t.id} thread={t} className="rounded-lg border border-line" showComposer={canComment} />
      ))}
      {canComment ? (
        <Composer
          metadata={{ stage, target }}
          className="rounded-lg border border-line"
          overrides={{ COMPOSER_PLACEHOLDER: placeholder ?? "의견을 남겨 보세요" }}
          onComposerSubmit={(c) => {
            track("comment.create", { target, length: JSON.stringify(c.body).length }, { stage });
          }}
        />
      ) : threads.length === 0 ? (
        <p className="text-[13px] text-ink-3">아직 댓글이 없어요.</p>
      ) : null}
    </div>
  );
}

export function DiscussionCount({ stage, target }: { stage: string; target: string }) {
  const { threads } = useThreads({ query: { metadata: { stage, target } } });
  const n = threads.reduce((a, t) => a + t.comments.filter((c) => !c.deletedAt).length, 0);
  return (
    <span className="inline-flex items-center gap-1">
      <MessageCircle size={14} />
      {n > 0 ? n : null}
    </span>
  );
}
