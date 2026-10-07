"use client";

import { FileUp, Globe, BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { ONLINE_MEDIA, OFFLINE_MEDIA } from "@/lib/media";
import { Button, Field, Input, Notice, Segmented, Spinner, Textarea, clsx } from "../ui";
import type { Material } from "./types";

type Form = {
  isOnline: boolean;
  mediaType: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  content: string;
  note: string;
  inputMethod: "manual" | "file";
  fileName: string | null;
  extractedChars: number | null;
};

const empty: Form = {
  isOnline: true,
  mediaType: "news",
  title: "",
  url: "",
  source: "",
  publishedAt: "",
  content: "",
  note: "",
  inputMethod: "manual",
  fileName: null,
  extractedChars: null,
};

function fromMaterial(m: Material): Form {
  return {
    isOnline: m.isOnline,
    mediaType: m.mediaType,
    title: m.title,
    url: m.url ?? "",
    source: m.source ?? "",
    publishedAt: m.publishedAt ?? "",
    content: m.content,
    note: m.note ?? "",
    inputMethod: m.inputMethod,
    fileName: m.fileName,
    extractedChars: m.extractedChars,
  };
}

export function MaterialForm({ material, onSaved, onCancel }: { material?: Material; onSaved: (m: Material) => void; onCancel: () => void }) {
  const [f, setF] = useState<Form>(material ? fromMaterial(material) : empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractWarn, setExtractWarn] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const media = f.isOnline ? ONLINE_MEDIA : OFFLINE_MEDIA;

  async function onFile(file: File) {
    setExtracting(true);
    setExtractWarn(null);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api<{ text: string; chars: number; title?: string | null; warning?: string | null }>("/api/extract", {
        method: "POST",
        body: form,
      });
      setF((p) => ({
        ...p,
        content: r.text,
        inputMethod: "file",
        fileName: file.name,
        extractedChars: r.chars,
        title: p.title || r.title || file.name.replace(/\.[^.]+$/, ""),
      }));
      setExtractWarn(r.warning ?? null);
      if (file.type === "application/pdf") {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(file));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...f,
        url: f.url.trim() || null,
        source: f.source.trim() || null,
        publishedAt: f.publishedAt.trim() || null,
        note: f.note.trim() || null,
      };
      const r = material
        ? await api<{ material: Material }>(`/api/materials/${material.id}`, { method: "PATCH", json: payload })
        : await api<{ material: Material }>("/api/materials", { method: "POST", json: payload });
      onSaved(r.material);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const changedAfterExtract = f.extractedChars != null && Math.abs(f.content.length - f.extractedChars) > 0;

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={f.isOnline ? "on" : "off"}
          onChange={(v) => {
            const on = v === "on";
            setF((p) => ({ ...p, isOnline: on, mediaType: on ? "news" : "book" }));
          }}
          options={[
            { value: "on", label: (<span className="flex items-center gap-1.5"><Globe size={15} /> 온라인 자료</span>) },
            { value: "off", label: (<span className="flex items-center gap-1.5"><BookOpen size={15} /> 오프라인 자료</span>) },
          ]}
        />
        <span className="text-[13px] text-ink-3">{f.isOnline ? "인터넷에서 찾은 자료" : "책, 신문, 면담처럼 인터넷 밖에서 찾은 자료"}</span>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">어떤 자료인가요?</span>
        <div className="flex flex-wrap gap-1.5">
          {media.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={f.mediaType === m.key}
              onClick={() => set("mediaType", m.key)}
              className={clsx(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                f.mediaType === m.key ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line-strong text-ink-2 hover:bg-[#f1efe9]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="제목" required>
        <Input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} required />
      </Field>

      {f.isOnline ? (
        <Field label="링크" required hint="자료가 있는 인터넷 주소를 붙여 넣어요.">
          <Input type="url" inputMode="url" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" required />
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.isOnline ? "만든 곳·글쓴이" : "지은이·펴낸 곳"} hint="출처 목록에 쓰여요.">
          <Input value={f.source} onChange={(e) => set("source", e.target.value)} maxLength={200} placeholder={f.isOnline ? "예: 한국교통안전공단" : "예: 김철수, 푸른출판사"} />
        </Field>
        <Field label="발행일·작성일">
          <Input value={f.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} maxLength={50} placeholder="예: 2025.3.14" />
        </Field>
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            내용<span className="ml-0.5 text-bad">*</span>
          </span>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.pptx,.hwpx,.txt,.md,.html"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = "";
              }}
            />
            <Button type="button" size="sm" onClick={() => fileRef.current?.click()} loading={extracting}>
              {extracting ? null : <FileUp size={15} />} 파일에서 글자 가져오기
            </Button>
          </div>
        </div>
        {f.inputMethod === "file" && f.fileName ? (
          <Notice tone="warn" className="mb-2">
            <b>{f.fileName}</b>에서 글자 {f.extractedChars?.toLocaleString()}자를 가져왔어요. 표·그림·쪽 번호·머리글이 섞이거나 빠지지
            않았는지 원문과 비교해서 고쳐 주세요.
            {changedAfterExtract ? <span className="ml-1 font-semibold">(지금 {f.content.length.toLocaleString()}자로 고침)</span> : null}
          </Notice>
        ) : null}
        {extractWarn ? <Notice tone="bad" className="mb-2">{extractWarn}</Notice> : null}
        <div className={clsx("grid gap-3", previewUrl && "lg:grid-cols-2")}>
          {previewUrl ? (
            <iframe src={previewUrl} title="원문 PDF" className="h-[420px] w-full rounded-lg border border-line" />
          ) : null}
          <div className="relative">
            <Textarea
              rows={previewUrl ? 17 : 10}
              value={f.content}
              onChange={(e) => set("content", e.target.value)}
              placeholder="자료의 내용을 붙여 넣거나 직접 옮겨 적어요. 책이나 면담 자료라면 중요한 부분을 옮겨 적어도 좋아요."
              className="font-[inherit]"
              required
            />
            {extracting ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-surface/80 text-sm text-ink-2">
                <Spinner /> 글자로 바꾸는 중…
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-right text-xs text-ink-3">{f.content.length.toLocaleString()}자</p>
      </div>

      <Field label="이 자료를 고른 까닭" hint="글의 목적이나 독자와 어떻게 관련되는지 적어 두면 나중에 고를 때 도움이 돼요.">
        <Textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={2000} />
      </Field>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {material ? "고친 내용 저장" : "자료 등록"}
        </Button>
      </div>
    </form>
  );
}
