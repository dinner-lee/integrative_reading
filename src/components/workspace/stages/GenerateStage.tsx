"use client";

import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useStorage, useUpdateMyPresence } from "@liveblocks/react/suspense";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, Reorder, motion, useDragControls } from "motion/react";
import { nanoid } from "nanoid";
import { useCallback, useMemo, useState } from "react";
import { track, trackDebounced } from "@/lib/client/logger";
import { mediaLabel } from "@/lib/media";
import { METHODS } from "@/lib/stages";
import type { Decision } from "../../../../liveblocks.config";
import { springs } from "../../motion";
import { Badge, Button, Collapse, Empty, Input, Notice, Spinner, Textarea, clsx, clusterColor } from "../../ui";
import { userKey, useRoomCtx } from "../context";
import { Discussion, DiscussionCount } from "../Discussion";
import { DraggableItem, dropClass, useDragToDrop } from "../dnd";
import { useMaterials } from "../hooks";
import { MaterialDetail } from "../MaterialDetail";
import { PlanSummary } from "../PlanSummary";
import { FocusDots } from "../Presence";
import type { Material } from "../types";

export const DECISIONS: { value: Decision; label: string; tone: "ok" | "warn" | "bad" | "neutral"; prompt: string }[] = [
  { value: "selected", label: "선정", tone: "ok", prompt: "글의 목적·독자에 왜 맞는지" },
  { value: "hold", label: "보류", tone: "warn", prompt: "무엇을 더 확인해야 하는지" },
  { value: "excluded", label: "제외", tone: "bad", prompt: "왜 쓰지 않는지(목적·신뢰성·중복 등)" },
];

/** 분석 단계의 ⑤ 이름·선별로 쓰인다 */
export function GenerateStage({ onGoAnalyze }: { onGoAnalyze?: () => void }) {
  const { groupId, canEdit, viewer } = useRoomCtx();
  const { materials } = useMaterials(groupId);
  // 읽기 전용으로 아직 만들어지지 않은 방을 열면 저장소가 비어 있을 수 있다
  const clustersRaw = useStorage((root) => root.clusters ?? null);
  const clusters = useMemo(() => clustersRaw ?? [], [clustersRaw]);
  const decisions = useStorage((root) => root.decisions);
  const board = useStorage((root) => root.board);
  const updatePresence = useUpdateMyPresence();
  const [viewing, setViewing] = useState<Material | null>(null);
  const byId = useMemo(() => new Map((materials ?? []).map((m) => [m.id, m])), [materials]);
  const me = userKey(viewer.role, viewer.id);

  const placed = new Set(clusters.flatMap((c) => c.materialIds));
  const unplaced = (materials ?? []).filter((m) => !placed.has(m.id));

  const startManual = useMutation(({ storage }, ids: string[]) => {
    storage.get("clusters").push(
      new LiveObject({ id: nanoid(8), name: "", note: "", keywords: [], origin: "human" as const, materialIds: new LiveList(ids) }),
    );
    track("generate.start_manual", {}, { stage: "generate" });
  }, []);

  const addCluster = useMutation(({ storage }) => {
    const id = nanoid(8);
    storage.get("clusters").push(new LiveObject({ id, name: "", note: "", keywords: [], origin: "human" as const, materialIds: new LiveList<string>([]) }));
    track("cluster.create", { clusterId: id }, { stage: "generate" });
  }, []);

  const moveMaterial = useMutation(({ storage }, materialId: string, toClusterId: string) => {
    const list = storage.get("clusters");
    let from: string | null = null;
    list.forEach((c) => {
      const ids = c.get("materialIds");
      const idx = ids.indexOf(materialId);
      if (idx >= 0) {
        from = c.get("id");
        ids.delete(idx);
      }
    });
    const target = list.find((c) => c.get("id") === toClusterId);
    target?.get("materialIds").push(materialId);
    track("cluster.move_material", { materialId, from, to: toClusterId }, { stage: "generate" });
  }, []);

  const moveCluster = useMutation(({ storage }, id: string, to: number) => {
    const list = storage.get("clusters");
    const from = list.findIndex((x) => x.get("id") === id);
    if (from < 0 || to < 0 || to >= list.length || from === to) return;
    list.move(from, to);
    track("cluster.reorder", { clusterId: id, from, to, via: "drag" }, { stage: "generate" });
  }, []);

  const setDecision = useMutation(
    ({ storage }, materialId: string, patch: { status?: Decision; reason?: string }) => {
      const map = storage.get("decisions");
      let d = map.get(materialId);
      if (!d) {
        d = new LiveObject({ status: "undecided" as Decision, reason: "", updatedBy: me, updatedAt: Date.now() });
        map.set(materialId, d);
      }
      d.update({ ...patch, updatedBy: me, updatedAt: Date.now() });
      if (patch.status !== undefined) track("decision.set", { materialId, status: patch.status }, { stage: "generate" });
      if (patch.reason !== undefined)
        trackDebounced(`reason:${materialId}`, "decision.reason", { materialId, reason: patch.reason, status: d.get("status") }, { stage: "generate" });
    },
    [me],
  );

  // 자료를 다른 묶음에 놓기 (놓은 자리가 같은 묶음이면 무시)
  const onDrop = useCallback(
    (materialId: string, targetId: string) => {
      const owner = clusters.find((c) => c.materialIds.includes(materialId));
      if (owner?.id !== targetId) moveMaterial(materialId, targetId);
    },
    [clusters, moveMaterial],
  );
  const dnd = useDragToDrop(onDrop);

  // 묶음 우선순위 드래그: 끄는 동안은 로컬 순서, 놓으면 한 번만 저장
  const liveOrder = clusters.map((c) => c.id);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const order = localOrder ?? liveOrder;
  const commitOrder = (id: string) => {
    if (localOrder) moveCluster(id, localOrder.indexOf(id));
    setLocalOrder(null);
  };

  if (!materials) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-ink-3">
        <Spinner /> 불러오는 중…
      </div>
    );
  }

  const counts = { selected: 0, hold: 0, excluded: 0, undecided: 0 };
  materials.forEach((m) => counts[(decisions?.[m.id]?.status ?? "undecided") as Decision]++);
  const clusterById = new Map(clusters.map((c) => [c.id, c]));

  return (
    <div className="panel px-6 py-6 sm:px-8 sm:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">묶음에 이름 붙이고 자료 고르기</h2>
          <p className="mt-0.5 text-sm text-ink-3">묶음을 원문과 대조해 이름을 붙이고 우선순위를 정해요. 자료마다 선정·보류·제외를 고르고 근거를 적어요.</p>
        </div>
        {canEdit && clusters.length ? (
          <Button onClick={addCluster}>
            <Plus size={15} /> 새 묶음
          </Button>
        ) : null}
      </div>
      <PlanSummary className="mb-4" />

      {clusters.length === 0 ? (
        <Empty title="아직 묶음이 없어요">
          <p>4 비교·채택에서 결과 하나를 골라 ‘이 결과로 이름 붙이기’를 눌러요.</p>
          {canEdit ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {onGoAnalyze ? (
                <Button variant="primary" onClick={onGoAnalyze}>
                  묶기로 가기
                </Button>
              ) : null}
              <Button onClick={() => startManual(materials.map((m) => m.id))} disabled={!materials.length}>
                분석 없이 직접 묶기
              </Button>
            </div>
          ) : null}
        </Empty>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {board?.runId ? (
              <span className="text-ink-3">
                {METHODS.find((m) => m.key === board.method)?.short} 결과에서 시작 · {board.adoptedBy}
              </span>
            ) : null}
            <span className="ml-auto flex flex-wrap gap-1.5">
              <Badge tone="ok">선정 {counts.selected}</Badge>
              <Badge tone="warn">보류 {counts.hold}</Badge>
              <Badge tone="bad">제외 {counts.excluded}</Badge>
              <Badge>아직 {counts.undecided}</Badge>
            </span>
          </div>

          {unplaced.length ? (
            <Notice tone="warn" className="mb-4">
              <b>아직 어느 묶음에도 없는 자료</b> (분석 뒤에 새로 등록됨):{" "}
              {unplaced.map((m, i) => (
                <span key={m.id}>
                  {i ? ", " : ""}
                  <button className="underline" onClick={() => setViewing(m)}>
                    {m.title}
                  </button>
                  {canEdit ? (
                    <select
                      className="ml-1 rounded-full bg-paper-2 px-2 text-xs"
                      value=""
                      onChange={(e) => e.target.value && moveMaterial(m.id, e.target.value)}
                      aria-label={`${m.title} 묶음 고르기`}
                    >
                      <option value="">묶음 고르기</option>
                      {clusters.map((c, j) => (
                        <option key={c.id} value={c.id}>
                          {j + 1}. {c.name || "이름 없음"}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </span>
              ))}
            </Notice>
          ) : null}

          <LayoutGroup id={`gen-${groupId}`}>
            <Reorder.Group as="ol" axis="y" values={order} onReorder={setLocalOrder} className="space-y-4">
              {order.map((id, i) => {
                const c = clusterById.get(id);
                if (!c) return null;
                return (
                  <ClusterCard
                    key={id}
                    index={i}
                    total={order.length}
                    cluster={c}
                    byId={byId}
                    decisions={decisions}
                    canEdit={canEdit}
                    allClusters={clusters.map((x) => ({ id: x.id, name: x.name }))}
                    onOpen={setViewing}
                    onMove={moveMaterial}
                    onMoveCluster={(dir) => moveCluster(id, i + dir)}
                    onDecision={setDecision}
                    dnd={dnd}
                    onReorderStart={() => setLocalOrder(liveOrder)}
                    onReorderEnd={() => commitOrder(id)}
                    onFocus={() => updatePresence({ focus: c.id })}
                  />
                );
              })}
            </Reorder.Group>
          </LayoutGroup>
        </>
      )}
      <MaterialDetail material={viewing} onClose={() => setViewing(null)} stage="generate" />
    </div>
  );
}

type ClusterView = { id: string; name: string; note: string; keywords: readonly string[]; origin: string; materialIds: readonly string[] };

function ClusterCard({
  index,
  total,
  cluster: c,
  byId,
  decisions,
  canEdit,
  allClusters,
  onOpen,
  onMove,
  onMoveCluster,
  onDecision,
  dnd,
  onReorderStart,
  onReorderEnd,
  onFocus,
}: {
  index: number;
  total: number;
  cluster: ClusterView;
  byId: Map<string, Material>;
  decisions: Readonly<Record<string, { status: Decision; reason: string }>> | null;
  canEdit: boolean;
  allClusters: { id: string; name: string }[];
  onOpen: (m: Material) => void;
  onMove: (materialId: string, to: string) => void;
  onMoveCluster: (dir: -1 | 1) => void;
  onDecision: (materialId: string, patch: { status?: Decision; reason?: string }) => void;
  dnd: ReturnType<typeof useDragToDrop>;
  onReorderStart: () => void;
  onReorderEnd: () => void;
  onFocus: () => void;
}) {
  const [talk, setTalk] = useState(false);
  const color = clusterColor(index);
  const controls = useDragControls();
  const over = dnd.over === c.id && !!dnd.dragging && !c.materialIds.includes(dnd.dragging);
  // 끌고 있는 자료가 든 묶음을 위로 올려, 다음 묶음 카드 아래로 숨지 않게 한다
  const lifting = !!dnd.dragging && c.materialIds.includes(dnd.dragging);

  const update = useMutation(({ storage }, field: "name" | "note", value: string) => {
    const obj = storage.get("clusters").find((x) => x.get("id") === c.id);
    obj?.set(field, value);
    trackDebounced(`cluster.${field}.${c.id}`, field === "name" ? "cluster.rename" : "cluster.note", { clusterId: c.id, value }, { stage: "generate" });
  }, [c.id]);

  const remove = useMutation(({ storage }) => {
    const list = storage.get("clusters");
    const idx = list.findIndex((x) => x.get("id") === c.id);
    if (idx >= 0 && list.get(idx)!.get("materialIds").length === 0) {
      list.delete(idx);
      track("cluster.delete", { clusterId: c.id }, { stage: "generate" });
    }
  }, [c.id]);

  return (
    <Reorder.Item
      as="li"
      value={c.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onReorderStart}
      onDragEnd={onReorderEnd}
      whileDrag={{ scale: 1.01, boxShadow: "0 24px 60px -24px rgb(0 0 0 / 0.35)", zIndex: 30 }}
      transition={springs.default}
      data-drop={c.id}
      onFocusCapture={onFocus}
      onMouseEnter={onFocus}
      className={clsx("card relative transition-[box-shadow] duration-150", dropClass(over))}
      style={{ borderLeft: `5px solid ${color}`, zIndex: lifting ? 50 : undefined }}
    >
      <div className="flex flex-wrap items-start gap-3 p-4 pb-3">
        {canEdit ? (
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            className="mt-1 cursor-grab touch-none rounded-lg p-1 text-ink-3 hover:bg-paper-2 active:cursor-grabbing"
            aria-label="끌어서 우선순위 바꾸기"
            title="끌어서 우선순위 바꾸기"
          >
            <GripVertical size={16} />
          </button>
        ) : null}
        <span className="mt-1.5 text-sm font-bold tabular-nums" style={{ color }} title="우선순위">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={c.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="묶음 이름을 함께 붙여 보세요 (예: 통학로 안전)"
              disabled={!canEdit}
              maxLength={40}
              className="h-9 font-semibold"
              aria-label="묶음 이름"
            />
            <FocusDots stage="generate" focus={c.id} />
          </div>
          {c.keywords.length ? (
            <p className="flex flex-wrap items-center gap-1 text-[13px] text-ink-3">
              <span>분석이 뽑은 낱말</span>
              {c.keywords.map((k) => (
                <span key={k} className="rounded-lg bg-paper-2 px-1.5 py-0.5 text-ink-2">
                  {k}
                </span>
              ))}
            </p>
          ) : (
            <p className="text-[13px] text-ink-3">{c.origin === "human" ? "모둠이 직접 만든 묶음" : ""}</p>
          )}
          <Textarea
            rows={1}
            value={c.note}
            onChange={(e) => update("note", e.target.value)}
            placeholder="이 묶음 자료들의 공통점, 글에서 어떤 하위 주제가 될지"
            disabled={!canEdit}
            maxLength={600}
            className="text-sm"
          />
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={() => setTalk((v) => !v)} aria-expanded={talk} title="모둠 논의">
            <DiscussionCount stage="generate" target={c.id} />
          </Button>
          {canEdit ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => onMoveCluster(-1)} disabled={index === 0} aria-label="우선순위 올리기">
                <ArrowUp size={15} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onMoveCluster(1)} disabled={index === total - 1} aria-label="우선순위 내리기">
                <ArrowDown size={15} />
              </Button>
              {c.materialIds.length === 0 ? (
                <Button size="sm" variant="ghost" onClick={remove} aria-label="빈 묶음 지우기">
                  <Trash2 size={15} />
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <Collapse open={talk}>
        <div className="border-t border-line bg-surface-2 px-4 py-3">
          <Discussion stage="generate" target={c.id} placeholder="이 묶음의 이름이나 자료 선택에 대해 의견을 남겨요" />
        </div>
      </Collapse>

      <ul className="divide-y divide-line border-t border-line">
        <AnimatePresence initial={false}>
          {c.materialIds.length === 0 ? (
            <motion.li key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4 text-center text-[13px] text-ink-3">
              {canEdit ? (over ? "여기에 놓으세요" : "다른 묶음에서 자료를 끌어다 놓을 수 있어요.") : "자료 없음"}
            </motion.li>
          ) : null}
          {c.materialIds.map((id) => {
            const m = byId.get(id);
            if (!m) return null;
            const d = decisions?.[id];
            return (
              <DraggableItem key={id} id={id} layoutId={`mat-${id}`} enabled={canEdit} handlers={dnd.handlers(id)} className={clsx("bg-surface", d?.status === "excluded" && "bg-surface-2")}>
                <MaterialRow
                  m={m}
                  status={d?.status ?? "undecided"}
                  reason={d?.reason ?? ""}
                  canEdit={canEdit}
                  clusterId={c.id}
                  allClusters={allClusters}
                  onOpen={() => onOpen(m)}
                  onMove={(to) => onMove(id, to)}
                  onDecision={(p) => onDecision(id, p)}
                />
              </DraggableItem>
            );
          })}
        </AnimatePresence>
      </ul>
    </Reorder.Item>
  );
}

function MaterialRow({
  m,
  status,
  reason,
  canEdit,
  clusterId,
  allClusters,
  onOpen,
  onMove,
  onDecision,
}: {
  m: Material;
  status: Decision;
  reason: string;
  canEdit: boolean;
  clusterId: string;
  allClusters: { id: string; name: string }[];
  onOpen: () => void;
  onMove: (to: string) => void;
  onDecision: (p: { status?: Decision; reason?: string }) => void;
}) {
  const def = DECISIONS.find((d) => d.value === status);
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? <GripVertical size={15} className="shrink-0 text-ink-3" aria-hidden /> : null}
        <button
          onClick={onOpen}
          onPointerDown={(e) => e.stopPropagation()}
          className={clsx("min-w-0 flex-1 text-left text-sm font-semibold hover:text-accent", status === "excluded" && "text-ink-3 line-through")}
        >
          {m.title}
          <span className="ml-2 text-xs font-normal text-ink-3">
            {m.isOnline ? "온라인" : "오프라인"} {mediaLabel(m.mediaType)}
            {m.source ? `, ${m.source}` : ""}
          </span>
        </button>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="판단" onPointerDown={(e) => e.stopPropagation()}>
          {DECISIONS.map((d) => (
            <button
              key={d.value}
              role="radio"
              aria-checked={status === d.value}
              disabled={!canEdit}
              onClick={() => onDecision({ status: status === d.value ? "undecided" : d.value })}
              className={clsx(
                "pressable h-7 rounded-full px-3 text-[13px] font-medium disabled:cursor-default",
                status === d.value
                  ? d.tone === "ok"
                    ? "bg-ok text-on-accent"
                    : d.tone === "warn"
                      ? "bg-warn text-on-accent"
                      : "bg-bad text-on-accent"
                  : "bg-paper-2 text-ink-2 hover:bg-paper-3",
              )}
            >
              {d.label}
            </button>
          ))}
          {canEdit && allClusters.length > 1 ? (
            <label className="relative ml-1 inline-flex items-center text-ink-3" title="다른 묶음으로 옮기기">
              <select
                value=""
                onChange={(e) => e.target.value && onMove(e.target.value)}
                className="h-7 w-7 cursor-pointer appearance-none rounded-full bg-paper-2 text-transparent"
                aria-label="다른 묶음으로 옮기기"
              >
                <option value="">옮기기</option>
                {allClusters
                  .filter((x) => x.id !== clusterId)
                  .map((x) => (
                    <option key={x.id} value={x.id} className="text-ink">
                      → {x.name || "이름 없는 묶음"}
                    </option>
                  ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute left-1.5" />
            </label>
          ) : null}
        </div>
      </div>
      <Collapse open={status !== "undecided"}>
        <div className="mt-2 pl-6" onPointerDown={(e) => e.stopPropagation()}>
          {canEdit ? (
            <Input
              value={reason}
              onChange={(e) => onDecision({ reason: e.target.value })}
              placeholder={`근거: ${def?.prompt}`}
              maxLength={500}
              className={clsx("h-8 text-sm", !reason && "border-warn/60")}
            />
          ) : (
            <p className="text-sm text-ink-2">근거: {reason || "아직 없음"}</p>
          )}
        </div>
      </Collapse>
    </div>
  );
}
