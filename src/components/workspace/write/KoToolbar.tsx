"use client";

import { FloatingToolbar, Toolbar } from "@liveblocks/react-tiptap";
import { useEditorState, type Editor } from "@tiptap/react";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, MessageSquarePlus, Pilcrow, Quote, Redo2, Undo2 } from "lucide-react";

/** Liveblocks 기본 도구 모음의 영어 이름을 한국어로 바꾼 도구 모음 */
function useMarks(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
          }
        : null,
  });
}

function Items({ editor, withHistory }: { editor: Editor | null; withHistory?: boolean }) {
  const s = useMarks(editor);
  if (!editor || !s) return null;
  const c = () => editor.chain().focus();
  return (
    <>
      {withHistory ? (
        <>
          <Toolbar.Button name="되돌리기" icon={<Undo2 size={16} />} shortcut="Mod-Z" onClick={() => c().undo().run()} />
          <Toolbar.Button name="다시 하기" icon={<Redo2 size={16} />} shortcut="Mod-Shift-Z" onClick={() => c().redo().run()} />
          <Toolbar.Separator />
          <Toolbar.Toggle name="본문" icon={<Pilcrow size={16} />} active={!s.h2 && !s.h3} onClick={() => c().setParagraph().run()} />
        </>
      ) : null}
      <Toolbar.Toggle name="큰 제목" icon={<Heading2 size={16} />} active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Toolbar.Toggle name="작은 제목" icon={<Heading3 size={16} />} active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <Toolbar.Separator />
      <Toolbar.Toggle name="굵게" icon={<Bold size={16} />} shortcut="Mod-B" active={s.bold} onClick={() => c().toggleBold().run()} />
      <Toolbar.Toggle name="기울임" icon={<Italic size={16} />} shortcut="Mod-I" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <Toolbar.Toggle name="글머리 목록" icon={<List size={16} />} active={s.bullet} onClick={() => c().toggleBulletList().run()} />
      <Toolbar.Toggle name="번호 목록" icon={<ListOrdered size={16} />} active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
      <Toolbar.Toggle name="인용" icon={<Quote size={16} />} active={s.quote} onClick={() => c().toggleBlockquote().run()} />
      <Toolbar.Separator />
      <Toolbar.Button name="댓글 달기" icon={<MessageSquarePlus size={16} />} onClick={() => c().addPendingComment().run()}>
        댓글
      </Toolbar.Button>
    </>
  );
}

export function KoToolbar({ editor }: { editor: Editor | null }) {
  return (
    <Toolbar editor={editor} className="flex-wrap">
      <Items editor={editor} withHistory />
    </Toolbar>
  );
}

export function KoFloatingToolbar({ editor, editable }: { editor: Editor | null; editable: boolean }) {
  return (
    <FloatingToolbar editor={editor}>
      {editable ? (
        <Items editor={editor} />
      ) : (
        <Toolbar.Button name="댓글 달기" icon={<MessageSquarePlus size={16} />} onClick={() => editor?.chain().focus().addPendingComment().run()}>
          댓글
        </Toolbar.Button>
      )}
    </FloatingToolbar>
  );
}
