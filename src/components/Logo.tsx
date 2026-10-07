/**
 * 로고. 밝은 모드엔 검정, 어두운 모드엔 흰색 SVG를 보여 준다(전환은 globals.css의 .logo-light/.logo-dark).
 * wordmark를 켜면 글자 로고(Cafe24ProUp)가 붙는다. 글자 로고의 높이는 아이콘 높이(size)와 같게 맞춘다:
 * 글자 상자 높이 = size, font-size는 한글 글자가 상자를 꽉 채우도록 size 기준으로 계산.
 */
export function Logo({ size = 32, className, wordmark }: { size?: number; className?: string; wordmark?: boolean }) {
  return (
    <span className={["inline-flex items-center", className].filter(Boolean).join(" ")} style={{ height: size, gap: Math.round(size * 0.25) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 테마별 SVG 두 장을 CSS로 바꿔 보여 준다 */}
      <img src="/logo-black.svg" alt="" width={size} height={size} className="logo-light shrink-0" style={{ width: size, height: size }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-white.svg" alt="" width={size} height={size} className="logo-dark shrink-0" style={{ width: size, height: size }} />
      {wordmark ? (
        <span className="brand flex items-center whitespace-nowrap" style={{ height: size, fontSize: Math.round(size * 1.08), lineHeight: 1 }}>
          엮어 쓰기
        </span>
      ) : null}
    </span>
  );
}
