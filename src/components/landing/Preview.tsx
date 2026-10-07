import { Check, Users } from "lucide-react";
import { clusterColor } from "@/lib/colors";

/**
 * 첫 화면용 분석 결과 축소판. 자료 지도를 큰 둥근 카드로 보여 주고,
 * 그 위에 떠 있는 알약 라벨과 모둠 논의 카드를 겹친다. 표시용이며 상호작용은 없다.
 */
const POINTS = [
  { x: 0.2, y: 0.3, c: 0, label: "자전거 도로 안전 수칙" },
  { x: 0.3, y: 0.44, c: 0, label: "안전한 통학로 만들기" },
  { x: 0.68, y: 0.3, c: 1, label: "자전거 통학과 건강" },
  { x: 0.78, y: 0.46, c: 1, label: "청소년 운동 습관" },
  { x: 0.6, y: 0.56, c: 1, label: "신상 자전거 할인", ad: true },
  { x: 0.5, y: 0.84, c: 2, label: "자전거와 탄소 중립" },
];
const CLUSTERS = ["통학로 안전", "건강과 운동", "환경"];

export function LandingPreview() {
  return (
    <div className="enter-fade relative" aria-label="자료 분석하기 화면 보기">
      <figure className="relative m-0 aspect-[4/3.4] overflow-hidden rounded-[var(--radius-panel)] bg-paper-2 shadow-card ring-1 ring-line sm:aspect-[4/3]">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_0%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_60%),radial-gradient(90%_70%_at_0%_100%,color-mix(in_srgb,#1b998b_10%,transparent),transparent_60%)]" />
        <svg viewBox="0 0 400 340" className="absolute inset-0 h-full w-full" role="img" aria-label="자료 6개를 두 축으로 펼친 지도">
          <line x1="200" x2="200" y1="24" y2="316" stroke="var(--line-strong)" strokeDasharray="3 5" />
          <line y1="170" y2="170" x1="24" x2="376" stroke="var(--line-strong)" strokeDasharray="3 5" />
          {POINTS.map((p, i) => (
            <g key={i}>
              <circle cx={p.x * 400} cy={p.y * 340} r={p.ad ? 22 : 18} fill={clusterColor(p.c)} fillOpacity={0.12} />
              <circle cx={p.x * 400} cy={p.y * 340} r={p.ad ? 10 : 8} fill={clusterColor(p.c)} stroke="var(--surface)" strokeWidth={2.5} />
            </g>
          ))}
        </svg>

        {/* 떠 있는 라벨 */}
        <span className="pill-bar absolute left-4 top-4 px-3 py-1.5 text-[13px] font-medium text-ink">3단계 자료 분석하기</span>
        <span className="pill-bar absolute right-4 top-4 px-3 py-1.5 text-[13px] font-medium text-ink">자전거 통학</span>
        <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-medium text-on-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" /> 함께 묶는 중
        </span>
        <span className="pill-bar absolute bottom-4 right-4 flex items-center gap-3 px-3 py-1.5 text-[13px] text-ink">
          <span className="flex items-center gap-1.5">
            <Users size={14} /> 모둠 4명, 한 화면에서
          </span>
          <span className="flex items-center gap-1 text-ink-3">
            <Check size={14} /> 저장됨
          </span>
        </span>

        {/* 묶음 범례 */}
        <ul className="absolute left-4 top-16 space-y-1.5">
          {CLUSTERS.map((n, i) => (
            <li key={n} className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: clusterColor(i) }} />
              {n}
            </li>
          ))}
        </ul>
      </figure>

      {/* 모둠 논의 카드 (사진 위 댓글 카드처럼 겹침) */}
      <div className="material-panel absolute -left-3 bottom-16 w-[min(300px,78%)] rounded-[var(--radius-card)] p-4 sm:-left-8 sm:bottom-20">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d6336c] text-[11px] font-bold text-white">하늘</span>
          <p className="text-sm">
            <span className="font-semibold">김하늘</span> <span className="text-ink-3">방금</span>
          </p>
        </div>
        <p className="mt-2.5 text-[15px] leading-snug">낱말은 비슷한데 광고 자료예요. 글의 목적엔 안 맞을 것 같아요.</p>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="rounded-full bg-bad-soft px-2.5 py-1 text-xs font-semibold text-bad">제외</span>
          <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-medium text-ink-2">신상 자전거 할인</span>
        </div>
      </div>
    </div>
  );
}
