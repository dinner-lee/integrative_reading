"use client";

import type { Editor } from "@tiptap/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, type PanInfo } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { GROUP_DRAFT_FIELD, studentDraftField } from "@/lib/rooms";
import { track } from "@/lib/client/logger";
import { project, springs } from "../../motion";
import { Button, Spinner, clsx } from "../../ui";
import { useRoomCtx } from "../context";
import { useMaterials } from "../hooks";
import { DraftEditor } from "../write/DraftEditor";
import { KoToolbar } from "../write/KoToolbar";
import { RefSidebar } from "../write/RefSidebar";

type DocTab = { key: string; label: string; field: string; editable: boolean };
const SIDEBAR_W = 300;

export function WriteStage() {
  const { groupId, canEdit, viewer, members, writingMode } = useRoomCtx();
  const { materials } = useMaterials(groupId);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const onEditor = useCallback((e: Editor | null) => setEditor(e), []);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => {
      setMobile(mq.matches);
      if (mq.matches) setSidebar(false);
    };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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

  const panel = <RefSidebar editor={editor} materials={materials} canInsert={!!tab?.editable} />;

  // 모바일 시트: 왼쪽에서 들어오고 왼쪽으로 나간다(같은 길). 놓는 속도의 방향으로 닫힐지 정한다.
  function onSheetDragEnd(_: unknown, info: PanInfo) {
    const projected = info.offset.x + project(info.velocity.x);
    if (projected < -SIDEBAR_W * 0.4 || info.velocity.x < -600) setSidebar(false);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex min-h-[calc(100dvh-140px)]">
        {!mobile ? (
          <motion.aside
            initial={false}
            animate={{ width: sidebar ? SIDEBAR_W : 0 }}
            transition={springs.default}
            className="shrink-0 overflow-hidden bg-surface-2"
            aria-hidden={!sidebar}
          >
            <div className="sticky top-[84px] h-[calc(100dvh-100px)]" style={{ width: SIDEBAR_W }}>
              {panel}
            </div>
          </motion.aside>
        ) : null}
        <AnimatePresence>
          {mobile && sidebar ? (
            <>
              <motion.div
                key="scrim"
                className="fixed inset-0 z-30 bg-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSidebar(false)}
              />
              <motion.aside
                key="sheet"
                className="material-panel fixed inset-y-0 left-0 z-40 w-[300px] touch-none"
                initial={{ x: -SIDEBAR_W }}
                animate={{ x: 0 }}
                exit={{ x: -SIDEBAR_W }}
                transition={springs.sheet}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.9, right: 0.05 }}
                dragMomentum={false}
                onDragEnd={onSheetDragEnd}
                aria-label="개요와 자료"
              >
                {panel}
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <section className="min-w-0 flex-1">
          {/* 카드 머리: 왼쪽 글 도구(회색 원), 오른쪽 문서 전환·사이드바 */}
          <div className="sticky top-[76px] z-10 flex flex-wrap items-center gap-2 bg-surface/95 px-4 pb-2 pt-4 backdrop-blur sm:px-8">
            <Button size="sm" variant="secondary" onClick={() => setSidebar((v) => !v)} aria-label={sidebar ? "사이드바 닫기" : "사이드바 열기"} aria-expanded={sidebar} className="h-9 w-9 px-0">
              {sidebar ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </Button>
            {tab?.editable ? <KoToolbar editor={editor} /> : <span className="text-[13px] text-ink-3">읽기 전용. 글자를 골라 댓글을 남길 수 있어요.</span>}
            <div className="ml-auto flex items-center gap-2">
              {tabs.length > 1 ? (
                <LayoutGroup id={`docs-${groupId}`}>
                  <div className="flex flex-wrap gap-0.5 rounded-full bg-paper-2 p-0.5" role="tablist">
                    {tabs.map((t) => {
                      const on = t.key === tab?.key;
                      return (
                        <button
                          key={t.key}
                          role="tab"
                          aria-selected={on}
                          onClick={() => {
                            setActive(t.key);
                            track("write.switch_doc", { field: t.field }, { stage: "write" });
                          }}
                          className={clsx("pressable relative rounded-full px-3 py-1 text-sm", on ? "font-semibold text-ink" : "text-ink-2 hover:text-ink")}
                        >
                          {on ? <motion.span layoutId="doc-pill" className="pill-thumb absolute inset-0 rounded-full" transition={springs.quick} aria-hidden /> : null}
                          <span className="relative">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              ) : null}
            </div>
          </div>
          <div className="px-6 pb-16 pt-6 sm:px-10">
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
