"use client";

import { LiveMap } from "@liveblocks/client";
import { useMutation, useStorage } from "@liveblocks/react/suspense";
import { trackDebounced } from "@/lib/client/logger";

/**
 * 글 제목 한 줄. 문서(field)마다 따로 저장되고 모둠원과 실시간으로 공유된다.
 * 테두리 없이 본문과 이어지는 투명 입력란.
 */
export function DocTitle({ field, editable }: { field: string; editable: boolean }) {
  // 예전 방에는 titles가 없을 수 있어 선택적으로 읽는다
  const title = useStorage((root) => root.titles?.[field] ?? "");
  const setTitle = useMutation(
    ({ storage }, value: string) => {
      let map = storage.get("titles");
      if (!map) {
        map = new LiveMap<string, string>();
        storage.set("titles", map);
      }
      map.set(field, value);
      trackDebounced(`write.title.${field}`, "write.title", { field, value }, { stage: "write" });
    },
    [field],
  );

  if (!editable) {
    return title ? <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">{title}</h1> : null;
  }
  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      maxLength={80}
      placeholder="제목을 써 주세요"
      aria-label="글 제목"
      className="doc-title w-full bg-transparent text-[28px] font-bold leading-tight tracking-tight outline-none placeholder:text-ink-3/60 sm:text-[32px]"
    />
  );
}
