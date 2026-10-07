"use client";

import { useThreads } from "@liveblocks/react/suspense";
import { AnchoredThreads, FloatingComposer, FloatingThreads, useLiveblocksExtension } from "@liveblocks/react-tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/client/logger";
import { KoFloatingToolbar, KoToolbar } from "./KoToolbar";

/**
 * Liveblocks Yjs 공동 편집기 하나 (field로 같은 방 안의 여러 글을 구분).
 * 주석 댓글은 본문 옆 여백(넓은 화면) 또는 떠 있는 창(좁은 화면)에 보인다.
 */
export function DraftEditor({
  field,
  editable,
  placeholder,
  onEditor,
}: {
  field: string;
  editable: boolean;
  placeholder: string;
  onEditor?: (e: Editor | null) => void;
}) {
  const liveblocks = useLiveblocksExtension({ field, comments: true, mentions: false });
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      liveblocks,
      StarterKit.configure({ undoRedo: false, heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: { attributes: { class: "prose-editor", "aria-label": "글 쓰는 곳" } },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  useDraftLogging(editor, field);

  const { threads } = useThreads({ query: { resolved: false, metadata: { stage: "write", target: field } } });
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        {editable ? (
          <div className="sticky top-[57px] z-10 -mx-1 mb-3 border-b border-line bg-surface/95 px-1 py-1.5 backdrop-blur">
            <KoToolbar editor={editor} />
          </div>
        ) : null}
        <EditorContent editor={editor} />
        <KoFloatingToolbar editor={editor} editable={editable} />
        <FloatingComposer
          editor={editor}
          metadata={{ stage: "write", target: field }}
          className="w-[340px]"
          onComposerSubmit={() => track("comment.create", { target: field, anchored: true }, { stage: "write" })}
        />
        {!wide ? <FloatingThreads editor={editor} threads={threads} className="w-[340px]" /> : null}
      </div>
      {wide ? (
        <div className="w-[300px] shrink-0">
          <AnchoredThreads editor={editor} threads={threads} />
        </div>
      ) : null}
    </div>
  );
}

/** 내가 고친 내용만 15초 간격으로 초고 스냅숏과 편집량을 기록 (다른 사람의 변경은 그 사람 브라우저가 기록) */
function useDraftLogging(editor: Editor | null, field: string) {
  const stats = useRef({ edits: 0, inserted: 0, deleted: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editor) return;
    const flush = () => {
      timer.current = null;
      const text = editor.getText({ blockSeparator: "\n" });
      track("draft.snapshot", { field, text, chars: text.replace(/\s/g, "").length, ...stats.current }, { stage: "write" });
      stats.current = { edits: 0, inserted: 0, deleted: 0 };
    };
    const onTx = ({ transaction }: { transaction: import("@tiptap/pm/state").Transaction }) => {
      if (!transaction.docChanged) return;
      const meta = transaction.getMeta("y-sync$") as { isChangeOrigin?: boolean } | undefined;
      if (meta?.isChangeOrigin) return; // 다른 사람이 보낸 변경
      const before = transaction.before.textContent.length;
      const after = transaction.doc.textContent.length;
      stats.current.edits++;
      if (after > before) stats.current.inserted += after - before;
      else stats.current.deleted += before - after;
      if (!timer.current) timer.current = setTimeout(flush, 15000);
    };
    editor.on("transaction", onTx);
    return () => {
      editor.off("transaction", onTx);
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    };
  }, [editor, field]);
}
