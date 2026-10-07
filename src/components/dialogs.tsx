"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Button, Field, Input, Modal, Notice } from "./ui";

type ConfirmOpts = { title: string; body?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PromptOpts = ConfirmOpts & { label: string; defaultValue?: string; placeholder?: string; mustMatch?: string; maxLength?: number };

type Pending =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void };

const Ctx = createContext<{
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
} | null>(null);

/**
 * 브라우저 기본 confirm/prompt 대신 쓰는 대화상자.
 * 확인은 되돌릴 수 없는 일에만 쓴다(되돌릴 수 있는 일은 토스트의 되돌리기로).
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ kind: "confirm", opts, resolve })), []);
  const prompt = useCallback((opts: PromptOpts) => new Promise<string | null>((resolve) => setPending({ kind: "prompt", opts, resolve })), []);
  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  function close(result: boolean | string | null) {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(Boolean(result));
    else pending.resolve(typeof result === "string" ? result : null);
    setPending(null);
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal open={!!pending} onClose={() => close(pending?.kind === "confirm" ? false : null)} title={pending?.opts.title ?? ""} size="sm">
        {pending ? <DialogBody pending={pending} onClose={close} /> : null}
      </Modal>
    </Ctx.Provider>
  );
}

function DialogBody({ pending, onClose }: { pending: Pending; onClose: (r: boolean | string | null) => void }) {
  const [text, setText] = useState(pending.kind === "prompt" ? (pending.opts.defaultValue ?? "") : "");
  const o = pending.opts;
  const mustMatch = pending.kind === "prompt" ? pending.opts.mustMatch : undefined;
  const invalid = pending.kind === "prompt" && (!text.trim() || (mustMatch !== undefined && text.trim() !== mustMatch));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pending.kind === "prompt") {
          if (!invalid) onClose(text.trim());
        } else onClose(true);
      }}
      className="space-y-4"
    >
      {o.body ? <div className="text-sm leading-relaxed text-ink-2">{o.body}</div> : null}
      {pending.kind === "prompt" ? (
        <Field label={pending.opts.label} hint={mustMatch ? `“${mustMatch}”를 그대로 입력해요.` : undefined}>
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={pending.opts.placeholder} maxLength={pending.opts.maxLength ?? 60} />
        </Field>
      ) : null}
      {o.danger ? <Notice tone="bad">이 작업은 되돌릴 수 없어요.</Notice> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onClose(pending.kind === "confirm" ? false : null)} autoFocus={pending.kind === "confirm"}>
          {o.cancelLabel ?? "취소"}
        </Button>
        <Button type="submit" variant={o.danger ? "danger" : "primary"} disabled={invalid}>
          {o.confirmLabel ?? "확인"}
        </Button>
      </div>
    </form>
  );
}

export function useDialog() {
  const v = useContext(Ctx);
  if (!v) throw new Error("DialogProvider missing");
  return v;
}
