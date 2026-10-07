"use client";

import { LiveObject } from "@liveblocks/client";
import { useMutation, useStorage } from "@liveblocks/react/suspense";
import { trackDebounced } from "@/lib/client/logger";
import { Card, Field, Input, SectionTitle, Textarea } from "../../ui";
import { userKey, useRoomCtx } from "../context";

const FORMATS = ["설명문", "안내문", "기사문", "보고서", "카드뉴스", "기타"];

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

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="계획하기"
        desc="무엇에 대해, 누구에게, 왜 쓰는지 정해요. 이 내용은 자료를 고르고 글을 쓸 때 계속 옆에 보여요."
      />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="space-y-4 p-5">
          <h3 className="font-bold">우리 모둠의 글</h3>
          <Field label="화제" hint="예: 자전거 통학, 우리 지역 하천 생태">
            <Input value={plan?.topic ?? ""} onChange={(e) => setPlan("topic", e.target.value)} disabled={!canEdit} maxLength={80} />
          </Field>
          <Field label="글의 목적" hint="읽은 사람이 무엇을 알게 되거나 할 수 있게 되기를 바라나요?">
            <Textarea rows={3} value={plan?.purpose ?? ""} onChange={(e) => setPlan("purpose", e.target.value)} disabled={!canEdit} maxLength={600} />
          </Field>
          <Field label="예상 독자" hint="누가 읽나요? 그 사람은 이 화제에 대해 얼마나 알고 있나요?">
            <Textarea rows={2} value={plan?.audience ?? ""} onChange={(e) => setPlan("audience", e.target.value)} disabled={!canEdit} maxLength={400} />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-semibold">글의 형식</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setPlan("format", plan?.format === f ? "" : f)}
                  aria-pressed={plan?.format === f}
                  className={
                    "rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed " +
                    (plan?.format === f ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line-strong bg-surface text-ink-2 hover:bg-[#f1efe9]")
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          {viewer.role === "student" && canEdit ? (
            <Card className="space-y-4 p-5">
              <div>
                <h3 className="font-bold">나의 생각</h3>
                <p className="text-[13px] text-ink-3">모둠원도 볼 수 있어요. 서로의 생각을 비교해 모둠 계획을 다듬어 보세요.</p>
              </div>
              <Field label="내가 생각하는 글의 목적">
                <Textarea rows={2} value={mine?.purpose ?? ""} onChange={(e) => setMine("purpose", e.target.value)} maxLength={400} />
              </Field>
              <Field label="내가 생각하는 예상 독자">
                <Input value={mine?.audience ?? ""} onChange={(e) => setMine("audience", e.target.value)} maxLength={200} />
              </Field>
              <Field label="독자가 궁금해할 것 · 찾아야 할 자료" hint="한 줄에 하나씩 적어 보세요.">
                <Textarea rows={4} value={mine?.questions ?? ""} onChange={(e) => setMine("questions", e.target.value)} maxLength={1000} />
              </Field>
            </Card>
          ) : null}

          <Card className="p-5">
            <h3 className="mb-3 font-bold">모둠원의 생각</h3>
            <ul className="space-y-3">
              {members
                .filter((m) => viewer.role !== "student" || m.id !== viewer.id || !canEdit)
                .map((m) => {
                  const p = memberPlans?.[userKey("student", m.id)];
                  return (
                    <li key={m.id} className="rounded-lg bg-[#f6f5f0] px-3 py-2.5 text-sm">
                      <p className="font-semibold">{m.name}</p>
                      {p && (p.purpose || p.audience || p.questions) ? (
                        <dl className="mt-1 space-y-1 text-ink-2">
                          {p.purpose ? (
                            <div>
                              <dt className="inline text-ink-3">목적 · </dt>
                              <dd className="inline">{p.purpose}</dd>
                            </div>
                          ) : null}
                          {p.audience ? (
                            <div>
                              <dt className="inline text-ink-3">독자 · </dt>
                              <dd className="inline">{p.audience}</dd>
                            </div>
                          ) : null}
                          {p.questions ? <dd className="whitespace-pre-line">{p.questions}</dd> : null}
                        </dl>
                      ) : (
                        <p className="mt-0.5 text-ink-3">아직 적지 않았어요.</p>
                      )}
                    </li>
                  );
                })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
