"use client";

import { shallow } from "@liveblocks/client";
import { useOthers, useSelf } from "@liveblocks/react/suspense";
import { STAGES } from "@/lib/stages";
import { clsx } from "../ui";

/** 지금 함께 접속한 사람과 그 사람이 보고 있는 단계 */
export function PresenceBar() {
  // 편집기 커서 같은 다른 presence 변화에는 다시 그리지 않도록 필요한 값만 고른다
  const others = useOthers(
    (list) => list.map((o) => ({ key: String(o.connectionId), name: o.info.name, color: o.info.color, stage: o.presence.stage, me: false })),
    (a, b) => a.length === b.length && a.every((x, i) => shallow(x, b[i])),
  );
  const self = useSelf((s) => ({ key: "self", name: s.info.name, color: s.info.color, stage: s.presence.stage, me: true }), shallow);
  const people = [...(self ? [self] : []), ...others];
  // 같은 사람이 여러 탭으로 들어온 경우 한 번만
  const seen = new Set<string>();
  const unique = people.filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true)));

  return (
    <div className="flex items-center -space-x-1.5" aria-label="지금 접속한 사람">
      {unique.slice(0, 8).map((p) => {
        const stage = STAGES.find((s) => s.key === p.stage);
        return (
          <span
            key={p.key}
            title={`${p.name}${p.me ? " (나)" : ""}${stage ? ` · ${stage.label}` : ""}`}
            className={clsx(
              "flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-[11px] font-bold text-white",
            )}
            style={{ background: p.color }}
          >
            {p.name.slice(-2)}
          </span>
        );
      })}
      {unique.length > 8 ? <span className="pl-2 text-xs text-ink-3">+{unique.length - 8}</span> : null}
    </div>
  );
}

/** 특정 단계·대상에 있는 다른 사람 이름 (예: 이 묶음을 보고 있는 친구) */
export function useWhoIsAt(stage: string, focus?: string) {
  return useOthers(
    (list) =>
      list
        .filter((o) => o.presence.stage === stage && (focus === undefined || o.presence.focus === focus))
        .map((o) => ({ name: o.info.name, color: o.info.color })),
    (a, b) => a.length === b.length && a.every((x, i) => shallow(x, b[i])),
  );
}

export function FocusDots({ stage, focus }: { stage: string; focus: string }) {
  const who = useWhoIsAt(stage, focus);
  if (!who.length) return null;
  return (
    <span className="inline-flex items-center -space-x-1" title={who.map((w) => w.name).join(", ") + " 보는 중"}>
      {who.slice(0, 4).map((w, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-full border border-surface" style={{ background: w.color }} />
      ))}
    </span>
  );
}
