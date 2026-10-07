"use client";

import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useStorage, useUpdateMyPresence } from "@liveblocks/react/suspense";
import { ArrowDown, ArrowUp, Check, Ellipsis, GripVertical, MessageCircle, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, Reorder, motion } from "motion/react";
import { nanoid } from "nanoid";
import { useCallback, useMemo, useState } from "react";
import { track, trackDebounced } from "@/lib/client/logger";
import { useDialog } from "../../dialogs";
import { springs } from "../../motion";
import { MenuItem, MenuSection, PopMenu } from "../../SettingsMenu";
import { Button, Collapse, Empty, SectionTitle, Segmented, Spinner, Textarea, clsx, clusterColor } from "../../ui";
import { useRoomCtx } from "../context";
import { Discussion } from "../Discussion";
import { DraggableItem, dropClass, useDragToDrop } from "../dnd";
import { useMaterials } from "../hooks";
import { MaterialDetail } from "../MaterialDetail";
import { PlanSummary } from "../PlanSummary";
import { FocusDots } from "../Presence";
import type { Material } from "../types";

const ROLES = { intro: "처음", body: "가운데", conclusion: "끝" } as const;
type Role = keyof typeof ROLES;

/** 조직하기: 왼쪽은 선정한 자료 목록, 오른쪽은 처음·가운데·끝 개요 칸 */
export function OrganizeStage() {
  const { groupId, canEdit } = useRoomCtx();
  const { materials } = useMaterials(groupId);
  const clusters = useStorage((root) => root.clusters ?? null) ?? [];
  const decisions = useStorage((root) => root.decisions);
  const outlineRaw = useStorage((root) => root.outline ?? null);
  const outline = useMemo(() => outlineRaw ?? [], [outlineRaw]);
  const updatePresence = useUpdateMyPresence();
  const [filter, setFilter] = useState<"selected" | "hold">("selected");
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
  const visible = (id: string) => status(id) === "selected" || (filter === "hold" && status(id) === "hold");
  const selectedTotal = materials.filter((m) => status(m.id) === "selected").length;
  const unplacedSelected = materials.filter((m) => status(m.id) === "selected" && !placedCount.get(m.id)).length;

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle title="조직하기" desc="선정한 자료를 개요의 어느 칸에 쓸지 정해요. 왼쪽 자료를 오른쪽 칸으로 끌어다 놓아요." />
      <PlanSummary className="mb-8" />
      <div className="grid gap-10 lg:grid-cols-[300px_1fr]">
        <aside className="panel p-5 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight">자료</h2>
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "selected", label: "선정" },
                { value: "hold", label: "보류까지" },
              ]}
            />
          </div>
          <p className="mb-4 text-sm text-ink-3">
            선정 {selectedTotal}개 중 아직 넣지 않은 자료 <b className={unplacedSelected ? "text-warn" : "text-ink"}>{unplacedSelected}</b>개
          </p>
          {selectedTotal === 0 && filter === "selected" ? (
            <Empty title="선정한 자료가 없어요">자료 분석하기의 ⑤ 이름·선별에서 자료를 ‘선정’해 주세요.</Empty>
          ) : (
            <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
              {clusters.map((c, i) => {
                const ids = c.materialIds.filter(visible);
                if (!ids.length) return null;
                return (
                  <div key={c.id}>
                    <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
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
                            className={clsx("flex items-center gap-2 rounded-xl px-3 py-2 text-sm", canEdit && "cursor-grab active:cursor-grabbing", n ? "text-ink-3" : "card-sm")}
                          >
                            {canEdit ? <GripVertical size={14} className="shrink-0 text-ink-3/70" aria-hidden /> : null}
                            <button onClick={() => setViewing(m)} onPointerDown={(e) => e.stopPropagation()} className="min-w-0 flex-1 truncate text-left hover:text-accent">
                              {m.title}
                            </button>
                            {status(id) === "hold" ? <span className="text-[11px] font-medium text-warn">보류</span> : null}
                            {n ? <Check size={14} className="shrink-0 text-ok" aria-label={`${n}곳에 넣음`} /> : null}
                          </DraggableItem>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight">개요</h2>
            {canEdit ? (
              <Button size="sm" onClick={addSection}>
                <Plus size={14} /> 가운데 칸 더하기
              </Button>
            ) : null}
          </div>
          <ol className="space-y-4">
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

  const moveMaterialTo = useMutation(({ storage }, materialId: string, to: number) => {
    const ids = storage.get("outline").find((x) => x.get("id") === s.id)?.get("materialIds");
    if (!ids) return;
    const from = ids.indexOf(materialId);
    if (from >= 0 && to >= 0 && to < ids.length && from !== to) {
      ids.move(from, to);
      track("outline.reorder_material", { sectionId: s.id, materialId, from, to }, { stage: "organize" });
    }
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

  // 칸 안 자료 순서: 끄는 동안은 로컬 순서, 놓으면 한 번만 저장
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const order = localOrder ?? [...s.materialIds];
  const commit = (id: string) => {
    if (localOrder) moveMaterialTo(id, localOrder.indexOf(id));
    setLocalOrder(null);
  };

  return (
    <motion.li layout transition={springs.default} data-drop={s.id} onMouseEnter={onFocus} onFocusCapture={onFocus} className={clsx("card transition-[box-shadow] duration-150", dropClass(over))}>
      <div className="flex items-start gap-3 px-5 pt-4">
        <span className={clsx("mt-2 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", s.role === "intro" ? "bg-accent-soft text-accent" : s.role === "conclusion" ? "bg-ok-soft text-ok" : "bg-paper-2 text-ink-2")}>
          {ROLES[s.role]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={s.title}
              onChange={(e) => update("title", e.target.value)}
              disabled={!canEdit}
              maxLength={60}
              aria-label="칸 제목"
              placeholder="소제목"
              className="w-full bg-transparent text-lg font-bold tracking-tight outline-none placeholder:text-ink-3 disabled:text-ink"
            />
            <FocusDots stage="organize" focus={s.id} />
          </div>
          <Textarea
            rows={1}
            value={s.point}
            onChange={(e) => update("point", e.target.value)}
            disabled={!canEdit}
            maxLength={800}
            placeholder={s.role === "intro" ? "화제를 어떻게 소개하고 독자의 관심을 끌까요?" : s.role === "conclusion" ? "무엇을 정리하고 강조할까요?" : "이 부분에서 전할 중심 내용"}
            className="mt-1 !bg-transparent !px-0 py-1 text-sm text-ink-2 !shadow-none focus:!shadow-none"
          />
        </div>
        <PopMenu icon={Ellipsis} label="칸 메뉴">
          <MenuSection>
            <MenuItem onClick={() => setTalk((v) => !v)}>
              <MessageCircle size={15} /> {talk ? "논의 닫기" : "모둠 논의"}
            </MenuItem>
          </MenuSection>
          {canEdit ? (
            <>
              <MenuSection title="위치">
                <MenuItem onClick={() => reorder(-1)} disabled={index === 0} className="disabled:opacity-40">
                  <ArrowUp size={15} /> 위로
                </MenuItem>
                <MenuItem onClick={() => reorder(1)} disabled={index === total - 1} className="disabled:opacity-40">
                  <ArrowDown size={15} /> 아래로
                </MenuItem>
              </MenuSection>
              <MenuSection title="역할">
                {(Object.keys(ROLES) as Role[]).map((r) => (
                  <MenuItem key={r} onClick={() => update("role", r)} aria-pressed={s.role === r}>
                    <span className="w-[15px]">{s.role === r ? <Check size={15} /> : null}</span> {ROLES[r]}
                  </MenuItem>
                ))}
              </MenuSection>
              <MenuSection>
                <MenuItem onClick={onRemove} className="text-bad hover:bg-bad-soft">
                  <Trash2 size={15} /> 칸 지우기
                </MenuItem>
              </MenuSection>
            </>
          ) : null}
        </PopMenu>
      </div>

      <div className="px-5 pb-4 pt-3">
        <AnimatePresence initial={false}>
          {order.length ? (
            <Reorder.Group as="ol" axis="y" values={order} onReorder={setLocalOrder} className="space-y-1.5">
              {order.map((id, j) => {
                const m = byId.get(id);
                return (
                  <Reorder.Item
                    key={id}
                    as="li"
                    value={id}
                    dragListener={canEdit}
                    onDragStart={() => setLocalOrder([...s.materialIds])}
                    onDragEnd={() => commit(id)}
                    whileDrag={{ scale: 1.01, boxShadow: "0 12px 30px -16px rgb(0 0 0 / 0.35)", zIndex: 10 }}
                    className={clsx("group flex items-center gap-2.5 rounded-xl bg-paper-2/70 px-3 py-2 text-sm", canEdit && "cursor-grab active:cursor-grabbing")}
                  >
                    <span className="w-4 text-xs tabular-nums text-ink-3">{j + 1}</span>
                    <button onClick={() => m && onOpen(m)} onPointerDown={(e) => e.stopPropagation()} className="min-w-0 flex-1 truncate text-left hover:text-accent">
                      {m?.title ?? "지워진 자료"}
                    </button>
                    {canEdit ? (
                      <button onClick={() => unplace(id)} onPointerDown={(e) => e.stopPropagation()} className="pressable rounded-full p-1 text-ink-3 opacity-0 hover:bg-paper-3 hover:text-bad focus:opacity-100 group-hover:opacity-100" aria-label="칸에서 빼기">
                        <X size={14} />
                      </button>
                    ) : null}
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          ) : (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl bg-paper-2/50 py-3 text-center text-[13px] text-ink-3">
              {canEdit ? (over ? "여기에 놓으세요" : "왼쪽에서 자료를 끌어다 놓아요.") : "넣은 자료 없음"}
            </motion.p>
          )}
        </AnimatePresence>
        {canEdit && candidates.length ? (
          <label className="mt-2 inline-flex items-center">
            <select value="" onChange={(e) => e.target.value && onPlace(e.target.value)} className="pressable h-8 cursor-pointer appearance-none rounded-full bg-paper-2 pl-3 pr-3 text-[13px] font-medium text-ink-2 hover:bg-paper-3" aria-label="이 칸에 자료 넣기">
              <option value="">+ 자료 넣기</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <Collapse open={talk}>
        <div className="border-t border-line px-5 py-4">
          <Discussion stage="organize" target={s.id} placeholder="이 칸에 어떤 자료를 어떤 순서로 쓸지 의견을 남겨요" />
        </div>
      </Collapse>
    </motion.li>
  );
}
