"use client";

import type { Editor } from "@tiptap/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useCallback, useState } from "react";
import { GROUP_DRAFT_FIELD, studentDraftField } from "@/lib/rooms";
import { track } from "@/lib/client/logger";
import { Button, Spinner, clsx } from "../../ui";
import { useRoomCtx } from "../context";
import { useMaterials } from "../hooks";
import { DraftEditor } from "../write/DraftEditor";
import { RefSidebar } from "../write/RefSidebar";

type DocTab = { key: string; label: string; field: string; editable: boolean };

export function WriteStage() {
  const { groupId, canEdit, viewer, members, writingMode } = useRoomCtx();
  const { materials } = useMaterials(groupId);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const onEditor = useCallback((e: Editor | null) => setEditor(e), []);

  const isStudentInGroup = viewer.role === "student" && canEdit;
  const tabs: DocTab[] = [];
  if (writingMode !== "individual") {
    tabs.push({ key: "group", label: "모둠 글", field: GROUP_DRAFT_FIELD, editable: canEdit });
  }
  if (writingMode !== "group") {
    if (isStudentInGroup) tabs.push({ key: "mine", label: "내 글", field: studentDraftField(viewer.id), editable: true });
    members
      .filter((m) => !(isStudentInGroup && m.id === viewer.id))
      .forEach((m) => tabs.push({ key: m.id, label: `${m.name}의 글`, field: studentDraftField(m.id), editable: false }));
  }
  const [active, setActive] = useState(tabs[0]?.key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];

  if (!materials) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-ink-3">
        <Spinner /> 불러오는 중…
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex min-h-[calc(100dvh-120px)]">
        <aside
          className={clsx(
            "shrink-0 border-r border-line bg-[#fbfaf7] transition-[width]",
            sidebar ? "w-[300px] max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:shadow-xl" : "w-0 overflow-hidden",
          )}
        >
          <div className="sticky top-[57px] h-[calc(100dvh-57px)]">
            {sidebar ? <RefSidebar editor={editor} materials={materials} canInsert={!!tab?.editable} /> : null}
          </div>
        </aside>
        <section className="min-w-0 flex-1 bg-surface px-4 py-4 sm:px-8">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSidebar((v) => !v)} aria-label={sidebar ? "사이드바 닫기" : "사이드바 열기"}>
                {sidebar ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                <span className="max-sm:hidden">{sidebar ? "자료 닫기" : "개요·자료 보기"}</span>
              </Button>
              {tabs.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setActive(t.key);
                        track("write.switch_doc", { field: t.field }, { stage: "write" });
                      }}
                      className={clsx(
                        "rounded-full px-3 py-1 text-sm",
                        t.key === tab?.key ? "bg-ink font-semibold text-white" : "bg-[#efede6] text-ink-2 hover:bg-[#e6e3da]",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="ml-auto text-[13px] text-ink-3">
                {tab?.editable ? "글자를 드래그해서 고르면 댓글을 달 수 있어요." : "읽기 전용 · 글자를 골라 댓글을 남길 수 있어요."}
              </p>
            </div>
            {tab ? (
              <DraftEditor
                key={tab.field}
                field={tab.field}
                editable={tab.editable}
                onEditor={onEditor}
                placeholder={
                  tab.key === "group"
                    ? "모둠이 함께 쓰는 글이에요. 왼쪽 개요를 넣고 시작해 보세요."
                    : "개요와 자료를 참고해서 글을 써요."
                }
              />
            ) : (
              <p className="text-sm text-ink-3">쓸 글이 없어요.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
