"use client";

import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { springs } from "../../motion";
import { useToast } from "../../toast";
import { Button, Card, Empty, Modal, Notice, Segmented, SectionTitle, Spinner } from "../../ui";
import { useRoomCtx } from "../context";
import { useMaterials } from "../hooks";
import { MaterialDetail, MaterialMeta } from "../MaterialDetail";
import { MaterialForm } from "../MaterialForm";
import type { Material } from "../types";

export function CollectStage() {
  const { groupId, canEdit, viewer } = useRoomCtx();
  const { materials, error, notify } = useMaterials(groupId);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [editing, setEditing] = useState<Material | "new" | null>(null);
  const [viewing, setViewing] = useState<Material | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const toast = useToast();

  const list = useMemo(
    () => (materials ?? []).filter((m) => filter === "all" || m.author?.id === viewer.id),
    [materials, filter, viewer.id],
  );
  const onlineCount = (materials ?? []).filter((m) => m.isOnline).length;

  // 바로 지우고 되돌릴 기회를 준다 (확인 창은 되돌릴 수 없는 일에만)
  async function remove(m: Material) {
    try {
      await api(`/api/materials/${m.id}`, { method: "DELETE" });
      setDeleteError(null);
      notify();
      toast({
        message: `‘${m.title}’ 자료를 지웠어요.`,
        action: {
          label: "되돌리기",
          onClick: async () => {
            try {
              await api(`/api/materials/${m.id}/restore`, { method: "POST" });
              notify();
            } catch (e) {
              setDeleteError((e as Error).message);
            }
          },
        },
      });
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="자료 모으기"
        desc="화제와 관련된 자료를 찾아 등록해요."
        actions={
          canEdit ? (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus size={16} /> 자료 등록
            </Button>
          ) : null
        }
      />

      {materials ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            모둠 자료 <b className="text-ink">{materials.length}</b>개 (온라인 {onlineCount}, 오프라인 {materials.length - onlineCount})
          </p>
          {canEdit ? (
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "모두" },
                { value: "mine", label: "내가 올린 자료" },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {deleteError ? <Notice tone="bad" className="mb-3">{deleteError}</Notice> : null}

      {!materials && !error ? (
        <div className="flex items-center gap-2 py-10 text-sm text-ink-3">
          <Spinner /> 자료를 불러오는 중…
        </div>
      ) : null}

      {materials && list.length === 0 ? (
        <Empty title="아직 등록한 자료가 없어요" icon={<FileText size={28} />}>
          {canEdit ? "모둠원이 함께 자료를 모아요. 자료가 4개 이상 모이면 다음 단계에서 묶어 볼 수 있어요." : null}
        </Empty>
      ) : null}

      <ul className="grid gap-3 md:grid-cols-2">
        <AnimatePresence initial={false}>
        {list.map((m) => (
          <motion.li key={m.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={springs.default}>
            <Card className="flex h-full flex-col p-4">
              <MaterialMeta m={m} />
              <button onClick={() => setViewing(m)} className="mt-2 text-left text-[15px] font-bold leading-snug hover:text-accent">
                {m.title}
              </button>
              <p className="mt-1 text-[13px] text-ink-3">
                {[m.source, m.publishedAt].filter(Boolean).join(", ") || "출처 정보 없음"}
              </p>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-2">{m.content}</p>
              <div className="mt-auto flex items-center justify-between pt-3 text-[13px] text-ink-3">
                <span>
                  {m.author?.name ?? "이름 없음"}, {m.content.length.toLocaleString()}자
                </span>
                {canEdit ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(m)} aria-label="고치기">
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label="지우기">
                      <Trash2 size={14} />
                    </Button>
                  </span>
                ) : null}
              </div>
            </Card>
          </motion.li>
        ))}
        </AnimatePresence>
      </ul>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "자료 등록" : "자료 고치기"} wide>
        {editing !== null ? (
          <MaterialForm
            material={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              notify();
            }}
          />
        ) : null}
      </Modal>
      <MaterialDetail material={viewing} onClose={() => setViewing(null)} stage="collect" />
    </div>
  );
}
