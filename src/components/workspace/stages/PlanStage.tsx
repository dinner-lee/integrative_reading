"use client";

import { LiveObject } from "@liveblocks/client";
import { useMutation, useStorage } from "@liveblocks/react/suspense";
import { trackDebounced } from "@/lib/client/logger";
import { colorFor } from "@/lib/rooms";
import { Field, Input, Section, SectionTitle, Sections, Textarea, clsx } from "../../ui";
import { userKey, useRoomCtx } from "../context";

const FORMATS = ["설명문", "안내문", "기사문", "보고서", "카드뉴스", "기타"];

/** 계획하기: 모둠 계획 한 장 + 모둠원 각자의 생각 */
export function PlanStage() {
  const { canEdit, viewer, members } = useRoomCtx();
  const plan = useStorage((root) => root.plan);
  const memberPlans = useStorage((root) => root.memberPlans);
  const myKey = userKey(viewer.role, viewer.id);

  const setPlan = useMutation(({ storage }, field: "topic" | "purpose" | "audience" | "format", value: string) => {
    storage.get("plan").set(field, value);
    trackDebounced(`plan.${field}`, "plan.edit", { field, value }, { stage: "plan" });
  }, []);

  const setMine = useMutation(
    ({ storage }, field: "purpose" | "audience" | "questions", value: string) => {
      const map = storage.get("memberPlans");
      let mine = map.get(myKey);
      if (!mine) {
        mine = new LiveObject({ purpose: "", audience: "", questions: "" });
        map.set(myKey, mine);
      }
      mine.set(field, value);
      trackDebounced(`plan.mine.${field}`, "plan.member_edit", { field, value }, { stage: "plan" });
    },
    [myKey],
  );

  const mine = memberPlans?.[myKey];
  const isMember = viewer.role === "student" && canEdit;

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle title="계획하기" desc="무엇에 대해, 누구에게, 왜 쓰는지 정해요." />

      <Sections>
        <Section title="우리 모둠의 글" desc="화제, 형식, 목적, 독자를 함께 정해요.">
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          <Field label="화제" hint="예: 자전거 통학">
            <Input value={plan?.topic ?? ""} onChange={(e) => setPlan("topic", e.target.value)} disabled={!canEdit} maxLength={80} />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-semibold">글의 형식</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => {
                const on = plan?.format === f;
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setPlan("format", on ? "" : f)}
                    aria-pressed={on}
                    className={clsx(
                      "pressable h-9 rounded-full border px-3.5 text-sm disabled:cursor-not-allowed",
                      on ? "border-primary bg-primary font-semibold text-on-primary" : "border-line bg-surface text-ink-2 hover:bg-paper-2",
                    )}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="글의 목적" hint="읽는 사람이 무엇을 알게 되거나 할 수 있게 되나요?">
            <Textarea rows={3} value={plan?.purpose ?? ""} onChange={(e) => setPlan("purpose", e.target.value)} disabled={!canEdit} maxLength={600} />
          </Field>
          <Field label="예상 독자" hint="누가 읽나요? 이 화제를 얼마나 알고 있나요?">
            <Textarea rows={3} value={plan?.audience ?? ""} onChange={(e) => setPlan("audience", e.target.value)} disabled={!canEdit} maxLength={400} />
          </Field>
        </div>
        </Section>

        {isMember ? (
          <Section title="나의 생각" desc="모둠원이 함께 봐요.">
            <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
              <Field label="내가 생각하는 목적">
                <Textarea rows={2} value={mine?.purpose ?? ""} onChange={(e) => setMine("purpose", e.target.value)} maxLength={400} />
              </Field>
              <Field label="내가 생각하는 독자">
                <Input value={mine?.audience ?? ""} onChange={(e) => setMine("audience", e.target.value)} maxLength={200} />
              </Field>
              <div className="md:col-span-2">
                <Field label="독자가 궁금해할 것, 찾아야 할 자료" hint="한 줄에 하나씩">
                  <Textarea rows={4} value={mine?.questions ?? ""} onChange={(e) => setMine("questions", e.target.value)} maxLength={1000} />
                </Field>
              </div>
            </div>
          </Section>
        ) : null}

        <Section title="모둠원의 생각">
          <ul className="divide-y divide-line">
            {members
              .filter((m) => !(isMember && m.id === viewer.id))
              .map((m) => {
                const p = memberPlans?.[userKey("student", m.id)];
                const filled = p && (p.purpose || p.audience || p.questions);
                return (
                  <li key={m.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: colorFor(m.id) }}>
                      {m.name.slice(-2)}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">{m.name}</p>
                      {filled ? (
                        <dl className="mt-1 space-y-1 text-ink-2">
                          {p.purpose ? (
                            <div className="flex gap-2">
                              <dt className="w-8 shrink-0 text-ink-3">목적</dt>
                              <dd>{p.purpose}</dd>
                            </div>
                          ) : null}
                          {p.audience ? (
                            <div className="flex gap-2">
                              <dt className="w-8 shrink-0 text-ink-3">독자</dt>
                              <dd>{p.audience}</dd>
                            </div>
                          ) : null}
                          {p.questions ? (
                            <div className="flex gap-2">
                              <dt className="w-8 shrink-0 text-ink-3">질문</dt>
                              <dd className="whitespace-pre-line">{p.questions}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : (
                        <p className="mt-0.5 text-ink-3">아직 적지 않았어요.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            {members.filter((m) => !(isMember && m.id === viewer.id)).length === 0 ? <li className="py-2 text-sm text-ink-3">아직 다른 모둠원이 없어요.</li> : null}
          </ul>
        </Section>
      </Sections>
    </div>
  );
}
