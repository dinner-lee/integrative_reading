"use client";

import { useStorage } from "@liveblocks/react/suspense";
import { Target } from "lucide-react";
import { clsx } from "../ui";

/** 자료를 고르고 쓸 때 늘 보이는 '글의 목적·독자' 띠 */
export function PlanSummary({ compact, className }: { compact?: boolean; className?: string }) {
  const plan = useStorage((root) => root.plan);
  const empty = !plan?.topic && !plan?.purpose && !plan?.audience;
  return (
    <div className={clsx("rounded-2xl border border-line px-4 py-3 text-sm", className)}>
      <div className="flex items-start gap-2">
        <Target size={16} className="mt-0.5 shrink-0 text-accent" />
        {empty ? (
          <p className="text-ink-2">계획하기 단계에서 화제·목적·독자를 먼저 정해 두면 여기에 보여요.</p>
        ) : (
          <dl className={clsx("grid gap-x-4 gap-y-0.5", compact ? "grid-cols-1" : "sm:grid-cols-[auto_1fr]")}>
            {plan?.topic ? (
              <>
                <dt className="font-semibold text-accent">화제</dt>
                <dd className="text-ink">
                  {plan.topic}
                  {plan.format ? <span className="text-ink-3"> · {plan.format}</span> : null}
                </dd>
              </>
            ) : null}
            {plan?.purpose ? (
              <>
                <dt className="font-semibold text-accent">목적</dt>
                <dd className="text-ink">{plan.purpose}</dd>
              </>
            ) : null}
            {plan?.audience ? (
              <>
                <dt className="font-semibold text-accent">독자</dt>
                <dd className="text-ink">{plan.audience}</dd>
              </>
            ) : null}
          </dl>
        )}
      </div>
    </div>
  );
}
