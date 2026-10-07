"use client";

import { ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { track } from "@/lib/client/logger";
import { citation, mediaLabel } from "@/lib/media";
import { Badge, Modal } from "../ui";
import type { Material } from "./types";

export function MaterialMeta({ m }: { m: Material }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={m.isOnline ? "accent" : "neutral"}>{m.isOnline ? "온라인" : "오프라인"}</Badge>
      <Badge>{mediaLabel(m.mediaType)}</Badge>
      {m.inputMethod === "file" ? <Badge tone="warn">파일 변환</Badge> : null}
    </div>
  );
}

/** 원문 대조용 자료 보기 (여러 단계에서 공통으로 사용) */
export function MaterialDetail({ material, onClose, stage }: { material: Material | null; onClose: () => void; stage: string }) {
  useEffect(() => {
    if (material) track("material.view", { materialId: material.id }, { stage });
  }, [material, stage]);

  return (
    <Modal open={!!material} onClose={onClose} title={material?.title ?? ""} wide>
      {material ? (
        <div className="space-y-4">
          <MaterialMeta m={material} />
          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            {material.source ? (
              <>
                <dt className="text-ink-3">출처</dt>
                <dd>{material.source}</dd>
              </>
            ) : null}
            {material.publishedAt ? (
              <>
                <dt className="text-ink-3">발행일</dt>
                <dd>{material.publishedAt}</dd>
              </>
            ) : null}
            {material.url ? (
              <>
                <dt className="text-ink-3">링크</dt>
                <dd className="min-w-0">
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={() => track("material.open_link", { materialId: material.id }, { stage })}
                    className="inline-flex max-w-full items-center gap-1 text-accent hover:underline"
                  >
                    <span className="truncate">{material.url}</span> <ExternalLink size={13} className="shrink-0" />
                  </a>
                </dd>
              </>
            ) : null}
            {material.fileName ? (
              <>
                <dt className="text-ink-3">원본 파일</dt>
                <dd>{material.fileName}</dd>
              </>
            ) : null}
            <dt className="text-ink-3">올린 사람</dt>
            <dd>{material.author?.name ?? "—"}</dd>
          </dl>
          {material.note ? (
            <div className="rounded-lg bg-accent-soft/60 px-3 py-2 text-sm">
              <span className="font-semibold">고른 까닭 · </span>
              {material.note}
            </div>
          ) : null}
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-[#fbfaf7] p-4 text-[15px] leading-relaxed">
            {material.content}
          </div>
          <p className="text-[13px] text-ink-3">출처 표기: {citation(material)}</p>
        </div>
      ) : null}
    </Modal>
  );
}
