import { clusterColor } from "@/lib/colors";

/**
 * 첫 화면용 분석 결과 축소판. 진짜 화면과 같은 구성(묶음 카드 + 자료 지도)을
 * 고정된 보기 자료로 그린다. 표시용이며 상호작용은 없다.
 */
const SAMPLE = {
  topic: "자전거 통학",
  clusters: [
    { name: "통학로 안전", terms: ["안전", "통학로", "횡단보도"], docs: ["자전거 도로 안전 수칙", "안전한 통학로 만들기"] },
    { name: "건강과 운동", terms: ["자전거", "운동", "건강"], docs: ["자전거 통학과 건강", "청소년 운동 습관", "신상 자전거 할인"] },
    { name: "환경", terms: ["탄소", "배출", "기후"], docs: ["자전거와 탄소 중립"] },
  ],
  points: [
    { x: 0.22, y: 0.3, c: 0 }, { x: 0.3, y: 0.42, c: 0 },
    { x: 0.66, y: 0.36, c: 1 }, { x: 0.74, y: 0.5, c: 1 }, { x: 0.6, y: 0.58, c: 1, ad: true },
    { x: 0.5, y: 0.82, c: 2 },
  ],
};

export function LandingPreview() {
  return (
    <div className="enter-fade rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5" aria-label="자료 분석하기 화면 보기">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">
          3단계 자료 분석하기 <span className="font-normal text-ink-3">보기: {SAMPLE.topic}</span>
        </p>
        <p className="text-xs text-ink-3">TF-IDF + k-평균, 묶음 3개</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
        <ul className="space-y-2">
          {SAMPLE.clusters.map((c, i) => (
            <li key={c.name} className="rounded-lg border border-line px-3 py-2" style={{ borderLeft: `4px solid ${clusterColor(i)}` }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{c.name}</span>
                <span className="text-[11px] text-ink-3">자료 {c.docs.length}</span>
              </div>
              <p className="mt-0.5 text-xs text-ink-3">{c.terms.join(", ")}</p>
            </li>
          ))}
        </ul>
        <figure className="relative m-0 overflow-hidden rounded-lg border border-line bg-surface-2">
          <svg viewBox="0 0 320 240" className="h-full w-full" role="img" aria-label="자료 6개를 두 축으로 펼친 지도">
            <line x1="160" x2="160" y1="12" y2="228" stroke="var(--line)" />
            <line y1="120" y2="120" x1="12" x2="308" stroke="var(--line)" />
            {SAMPLE.points.map((p, i) => (
              <circle key={i} cx={p.x * 320} cy={p.y * 240} r={p.ad ? 9 : 7} fill={clusterColor(p.c)} fillOpacity={0.9} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </svg>
          <figcaption className="absolute bottom-2 left-2 right-2 rounded-lg bg-surface/90 px-2 py-1 text-[11px] leading-snug text-ink-2">
            낱말이 비슷해 「건강과 운동」에 묶인 자전거 광고. 글의 목적에 맞을까요?
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
