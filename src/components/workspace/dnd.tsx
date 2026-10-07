"use client";

import { motion, type PanInfo } from "motion/react";
import { useCallback, useState, type ReactNode } from "react";
import { springs } from "../motion";
import { clsx } from "../ui";

/**
 * 포인터 드래그로 항목을 다른 통에 놓기.
 * - 손가락(포인터)에 1:1로 붙어 움직인다(브라우저 고스트 이미지 없음).
 * - 끄는 동안 지금 포인터 아래의 놓을 자리를 실시간으로 알려 준다.
 * - 놓으면 스프링으로 제자리(또는 새 자리)에 안착한다.
 */
export function useDragToDrop(onDrop: (itemId: string, targetId: string) => void) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const find = useCallback((info: PanInfo, itemId: string) => {
    const x = info.point.x - window.scrollX;
    const y = info.point.y - window.scrollY;
    for (const el of document.elementsFromPoint(x, y)) {
      const h = el as HTMLElement;
      // 끌고 있는 항목 자신(포인터 바로 아래)은 건너뛴다
      if (h.closest?.("[data-item]")?.getAttribute("data-item") === itemId) continue;
      const t = h.closest?.("[data-drop]");
      if (t) return t.getAttribute("data-drop");
    }
    return null;
  }, []);

  const handlers = useCallback(
    (itemId: string) => ({
      onDragStart: () => setDragging(itemId),
      onDrag: (_: unknown, info: PanInfo) => setOver(find(info, itemId)),
      onDragEnd: (_: unknown, info: PanInfo) => {
        const t = find(info, itemId);
        setDragging(null);
        setOver(null);
        if (t) onDrop(itemId, t);
      },
    }),
    [find, onDrop],
  );

  return { dragging, over, handlers };
}

export function DraggableItem({
  id,
  enabled,
  handlers,
  children,
  className,
  layoutId,
}: {
  id: string;
  enabled: boolean;
  handlers: ReturnType<ReturnType<typeof useDragToDrop>["handlers"]>;
  children: ReactNode;
  className?: string;
  layoutId?: string;
}) {
  return (
    <motion.li
      layout
      layoutId={layoutId}
      drag={enabled}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={1}
      whileDrag={{ scale: 1.02, zIndex: 40, boxShadow: "0 16px 40px -16px rgb(0 0 0 / 0.35)" }}
      transition={springs.drop}
      data-item={id}
      className={clsx("relative", enabled && "touch-none", className)}
      {...(enabled ? handlers : {})}
    >
      {children}
    </motion.li>
  );
}

/** 놓을 자리 강조 */
export function dropClass(active: boolean) {
  return active ? "shadow-[0_0_0_2px_var(--accent),0_0_0_6px_color-mix(in_srgb,var(--accent)_18%,transparent)]" : "";
}
