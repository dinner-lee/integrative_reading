export const ONLINE_MEDIA = [
  { key: "news", label: "인터넷 기사" },
  { key: "public", label: "공공기관·단체 누리집" },
  { key: "encyclopedia", label: "백과사전·사전" },
  { key: "blog", label: "블로그·카페·SNS" },
  { key: "video", label: "영상(자막·요약)" },
  { key: "report", label: "보고서·논문" },
  { key: "other", label: "기타" },
] as const;

export const OFFLINE_MEDIA = [
  { key: "book", label: "책" },
  { key: "periodical", label: "신문·잡지" },
  { key: "print", label: "안내문·인쇄물" },
  { key: "interview", label: "면담·설문" },
  { key: "report", label: "보고서·논문" },
  { key: "other", label: "기타" },
] as const;

const LABELS: Record<string, string> = Object.fromEntries(
  [...ONLINE_MEDIA, ...OFFLINE_MEDIA].map((m) => [m.key, m.label]),
);

export function mediaLabel(key: string) {
  return LABELS[key] ?? "기타";
}

/** 출처 목록 한 줄: 지은이/만든 곳, 「제목」, 발행일, 주소 */
export function citation(m: {
  title: string;
  source?: string | null;
  publishedAt?: string | null;
  url?: string | null;
  isOnline: boolean;
}) {
  const parts = [m.source?.trim(), `「${m.title.trim()}」`, m.publishedAt?.trim()].filter(Boolean);
  let line = parts.join(", ");
  if (m.isOnline && m.url) line += `, ${m.url}`;
  return line;
}
