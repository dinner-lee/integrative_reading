"use client";

import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useStorage, useUpdateMyPresence } from "@liveblocks/react/suspense";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { nanoid } from "nanoid";
import { useCallback, useMemo, useState } from "react";
import { track, trackDebounced } from "@/lib/client/logger";
import { useDialog } from "../../dialogs";
import { springs } from "../../motion";
import { Badge, Button, Card, Collapse, Empty, Input, SectionTitle, Spinner, Textarea, clsx, clusterColor } from "../../ui";
import { useRoomCtx } from "../context";
import { Discussion, DiscussionCount } from "../Discussion";
import { DraggableItem, dropClass, useDragToDrop } from "../dnd";
import { useMaterials } from "../hooks";
import { MaterialDetail } from "../MaterialDetail";
import { PlanSummary } from "../PlanSummary";
import { FocusDots } from "../Presence";
import type { Material } from "../types";

const ROLES = { intro: "처음", body: "가운데", conclusion: "끝" } as const;
type Role = keyof typeof ROLES;

export function OrganizeStage() {
  const { groupId, canEdit } = useRoomCtx();
  const { materials } = useMaterials(groupId);
  const clusters = useStorage((root) => root.clusters ?? null) ?? [];
  const decisions = useStorage((root) => root.decisions);
  const outlineRaw = useStorage((root) => root.outline ?? null);
  const outline = useMemo(() => outlineRaw ?? [], [outlineRaw]);
  const updatePresence = useUpdateMyPresence();
  const [showHold, setShowHold] = useState(false);
  const [viewing, setViewing] = useState<Material | null>(null);
  const byId = useMemo(() => new Map((materials ?? []).map((m) => [m.id, m])), [materials]);

  const placedCount = useMemo(() => {
    const m = new Map<string, number>();
    outline.forEach((s) => s.materialIds.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1)));
    return m;
  }, [outline]);

  const addSection = useMutation(({ storage }) => {
    const id = nanoid(8);
    const list = storage.get("outline");
    // '끝' 앞에 새 가운데 칸을 넣는다
    let at = list.length;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list.get(i)!.get("role") === "conclusion") at = i;
      else break;
    }
    let n = 1;
    list.forEach((s) => {
      if (s.get("role") === "body") n++;
    });
    list.insert(new LiveObject({ id, title: `가운데 ${n}`, role: "body" as Role, point: "", materialIds: new LiveList<string>([]) }), at);
    track("outline.add_section", { sectionId: id }, { stage: "organize" });
  }, []);

  const place = useMutation(({ storage }, sectionId: string, materialId: string) => {
    const s = storage.get("outline").find((x) => x.get("id") === sectionId);
    if (!s || s.get("materialIds").indexOf(materialId) >= 0) return;
    s.get("materialIds").push(materialId);
    track("outline.place", { sectionId, materialId, via: "drag" }, { stage: "organize" });
  }, []);

  const onDrop = useCallback((materialId: string, sectionId: string) => place(sectionId, materialId), [place]);
  const dnd = useDragToDrop(onDrop);

  if (!materials) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-ink-3">
        <Spinner /> 불러오는 중…
      </div>
    );
  }

  const status = (id: string) => decisions?.[id]?.status ?? "undecided";
  const visible = (id: string) => status(id) === "selected" || (showHold && status(id) === "hold");
  const selectedTotal = materials.filter((m) => status(m.id) === "selected").length;
  const unplacedSelected = materials.filter((m) => status(m.id) === "selected" && !placedCount.get(m.id)).length;

  return (
    <div>
      <SectionTitle
        title="조직하기"
        desc="선정한 자료를 개요의 어느 칸에 쓸지 정해요."
      />
      <PlanSummary className="mb-4" />
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold">선정한 자료</h3>
              <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <input type="checkbox" className="accent-[var(--accent)]" checked={showHold} onChange={(e) => setShowHold(e.target.checked)} />
                보류도 보기
              </label>
            </div>
            <p className="mb-3 text-[13px] text-ink-3">
              선정 {selectedTotal}개 중 개요에 넣지 않은 자료 <b className={unplacedSelected ? "text-warn" : ""}>{unplacedSelected}</b>개
            </p>
            {selectedTotal === 0 && !showHold ? (
              <Empty title="선정한 자료가 없어요">내용 생성하기에서 자료를 ‘선정’해 주세요.</Empty>
            ) : (
              <div className="max-h-[65vh] space-y-3 overflow-y-auto">
                {clusters.map((c, i) => {
                  const ids = c.materialIds.filter(visible);
                  if (!ids.length) return null;
                  return (
                    <div key={c.id}>
                      <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: clusterColor(i) }} />
                        {c.name || `이름 없는 묶음 ${i + 1}`}
                      </p>
                      <ul className="space-y-1">
                        {ids.map((id) => {
                          const m = byId.get(id);
                          if (!m) return null;
                          const n = placedCount.get(id) ?? 0;
                          return (
                            <DraggableItem
                              key={id}
                              id={id}
                              enabled={canEdit}
                              handlers={dnd.handlers(id)}
                              className={clsx(
                                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm",
                                canEdit && "cursor-grab active:cursor-grabbing",
                                n ? "bg-surface-2" : "card-sm",
                              )}
                            >
                              {canEdit ? <GripVertical size={14} className="shrink-0 text-ink-3" aria-hidden /> : null}
                              <button onClick={() => setViewing(m)} onPointerDown={(e) => e.stopPropagation()} className="min-w-0 flex-1 truncate text-left hover:text-accent">
                                {m.title}
                              </button>
                              {status(id) === "hold" ? <Badge tone="warn">보류</Badge> : null}
                              {n ? <Badge tone="ok">{n}곳</Badge> : null}
                            </DraggableItem>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </aside>

        <section>
          <ol className="space-y-3">
            {outline.map((s, i) => (
              <SectionCard
                key={s.id}
                section={s}
                index={i}
                total={outline.length}
                byId={byId}
                canEdit={canEdit}
                over={dnd.over === s.id && !!dnd.dragging && !s.materialIds.includes(dnd.dragging)}
                candidates={materials.filter((m) => visible(m.id) && !s.materialIds.includes(m.id))}
                onPlace={(mid) => place(s.id, mid)}
                onOpen={setViewing}
                onFocus={() => updatePresence({ focus: s.id })}
              />
            ))}
          </ol>
          {canEdit ? (
            <Button className="mt-3" onClick={addSection}>
              <Plus size={15} /> 가운데 칸 더하기
            </Button>
          ) : null}
        </section>
      </div>
      <MaterialDetail material={viewing} onClose={() => setViewing(null)} stage="organize" />
    </div>
  );
}

type SectionView = { id: string; title: string; role: Role; point: string; materialIds: readonly string[] };

function SectionCard({
  section: s,
  index,
  total,
  byId,
  canEdit,
  over,
  candidates,
  onPlace,
  onOpen,
  onFocus,
}: {
  section: SectionView;
  index: number;
  total: number;
  byId: Map<string, Material>;
  canEdit: boolean;
  over: boolean;
  candidates: Material[];
  onPlace: (materialId: string) => void;
  onOpen: (m: Material) => void;
  onFocus: () => void;
}) {
  const [talk, setTalk] = useState(false);
  const { confirm } = useDialog();

  const update = useMutation(({ storage }, field: "title" | "point" | "role", value: string) => {
    storage.get("outline").find((x) => x.get("id") === s.id)?.set(field, value as never);
    trackDebounced(`outline.${field}.${s.id}`, "outline.edit", { sectionId: s.id, field, value }, { stage: "organize" });
  }, [s.id]);

  const unplace = useMutation(({ storage }, materialId: string) => {
    const ids = storage.get("outline").find((x) => x.get("id") === s.id)?.get("materialIds");
    const idx = ids?.indexOf(materialId) ?? -1;
    if (ids && idx >= 0) ids.delete(idx);
    track("outline.unplace", { sectionId: s.id, materialId }, { stage: "organize" });
  }, [s.id]);

  const moveMaterial = useMutation(({ storage }, materialId: string, dir: -1 | 1) => {
    const ids = storage.get("outline").find((x) => x.get("id") === s.id)?.get("materialIds");
    if (!ids) return;
    const from = ids.indexOf(materialId);
    const to = from + dir;
    if (from >= 0 && to >= 0 && to < ids.length) ids.move(from, to);
  }, [s.id]);

  const reorder = useMutation(({ storage }, dir: -1 | 1) => {
    const list = storage.get("outline");
    const from = list.findIndex((x) => x.get("id") === s.id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= list.length) return;
    list.move(from, to);
    track("outline.reorder", { sectionId: s.id, from, to }, { stage: "organize" });
  }, [s.id]);

  const remove = useMutation(({ storage }) => {
    const list = storage.get("outline");
    const idx = list.findIndex((x) => x.get("id") === s.id);
    if (idx >= 0) list.delete(idx);
    track("outline.delete_section", { sectionId: s.id }, { stage: "organize" });
  }, [s.id]);

  async function onRemove() {
    if (s.materialIds.length === 0) return remove();
    const ok = await confirm({
      title: `‘${s.title}’ 칸을 지울까요?`,
      body: `이 칸에 넣어 둔 자료 ${s.materialIds.length}개는 왼쪽 목록에 그대로 남아요.`,
      confirmLabel: "지우기",
      danger: true,
    });
    if (ok) remove();
  }

  return (
    <motion.li
      layout
      transition={springs.default}
      data-drop={s.id}
      onMouseEnter={onFocus}
      onFocusCapture={onFocus}
      className={clsx("card transition-[box-shadow] duration-150", dropClass(over))}
    >
      <div className="flex flex-wrap items-start gap-3 p-4">
        <select
          value={s.role}
          onChange={(e) => update("role", e.target.value)}
          disabled={!canEdit}
          className={clsx(
            "h-9 rounded-lg border px-2 text-sm font-bold",
            s.role === "intro" && "border-accent/30 bg-accent-soft text-accent",
            s.role === "body" && "border-line-strong bg-paper-2 text-ink",
            s.role === "conclusion" && "border-ok/30 bg-ok-soft text-ok",
          )}
          aria-label="개요 위치"
        >
          {Object.entries(ROLES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input value={s.title} onChange={(e) => update("title", e.target.value)} disabled={!canEdit} maxLength={60} className="h-9 font-semibold" aria-label="칸 제목" placeholder="소제목" />
            <FocusDots stage="organize" focus={s.id} />
          </div>
          <Textarea
            rows={2}
            value={s.point}
            onChange={(e) => update("point", e.target.value)}
            disabled={!canEdit}
            maxLength={800}
            placeholder={s.role === "intro" ? "화제를 어떻게 소개하고 독자의 관심을 끌까요?" : s.role === "conclusion" ? "무엇을 정리하고 강조할까요?" : "이 부분에서 전할 중심 내용"}
            className="text-sm"
          />
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={() => setTalk((v) => !v)} aria-expanded={talk} title="모둠 논의">
            <DiscussionCount stage="organize" target={s.id} />
          </Button>
          {canEdit ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => reorder(-1)} disabled={index === 0} aria-label="위로">
                <ArrowUp size={15} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => reorder(1)} disabled={index === total - 1} aria-label="아래로">
                <ArrowDown size={15} />
              </Button>
              <Button size="sm" variant="ghost" onClick={onRemove} aria-label="칸 지우기">
                <Trash2 size={15} />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line px-4 py-3">
        <AnimatePresence initial={false}>
          {s.materialIds.length ? (
            <ol className="space-y-1.5">
              {s.materialIds.map((id, j) => {
                const m = byId.get(id);
                return (
                  <motion.li
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={springs.quick}
                    className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm"
                  >
                    <span className="text-xs tabular-nums text-ink-3">{j + 1}</span>
                    <button onClick={() => m && onOpen(m)} className="min-w-0 flex-1 truncate text-left hover:text-accent">
                      {m?.title ?? "지워진 자료"}
                    </button>
                    {canEdit ? (
                      <span className="flex items-center">
                        <button onClick={() => moveMaterial(id, -1)} disabled={j === 0} className="pressable p-0.5 text-ink-3 hover:text-ink disabled:opacity-30" aria-label="앞으로">
                          <ArrowUp size={13} />
                        </button>
                        <button
                          onClick={() => moveMaterial(id, 1)}
                          disabled={j === s.materialIds.length - 1}
                          className="pressable p-0.5 text-ink-3 hover:text-ink disabled:opacity-30"
                          aria-label="뒤로"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button onClick={() => unplace(id)} className="pressable p-0.5 text-ink-3 hover:text-bad" aria-label="칸에서 빼기">
                          <X size={14} />
                        </button>
                      </span>
                    ) : null}
                  </motion.li>
                );
              })}
            </ol>
          ) : (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-1 text-center text-[13px] text-ink-3">
              {canEdit ? (over ? "여기에 놓으세요" : "자료를 끌어다 놓거나 아래에서 골라요.") : "넣은 자료 없음"}
            </motion.p>
          )}
        </AnimatePresence>
        {canEdit && candidates.length ? (
          <select
            value=""
            onChange={(e) => e.target.value && onPlace(e.target.value)}
            className="mt-2 h-9 w-full rounded-full bg-paper-2 px-3 text-[13px] text-ink-2"
            aria-label="이 칸에 자료 넣기"
          >
            <option value="">+ 이 칸에 자료 넣기</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <Collapse open={talk}>
        <div className="border-t border-line bg-surface-2 px-4 py-3">
          <Discussion stage="organize" target={s.id} placeholder="이 칸에 어떤 자료를 어떤 순서로 쓸지 의견을 남겨요" />
        </div>
      </Collapse>
    </motion.li>
  );
}
