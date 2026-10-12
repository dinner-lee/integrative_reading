"use client";

import { useEffect, useState } from "react";
import NebulaDrift from "./NebulaDrift";

/**
 * 로그인·학급 입장 화면의 배경: 화면 전체에 깔리는 Nebula Drift.
 * 가산 블렌딩이라 밝은 바탕에서는 보이지 않으므로 두 모드 모두 깊은 남색 바탕을 쓰되,
 * 어두운 모드는 앱의 어두운 바탕(oklch 12%)에 가깝게, 밝은 모드는 조금 밝은 남색으로 둔다.
 * 염료·입자 색은 앱의 강조색(파랑, 색상각 254)과 같은 계열이다.
 */
// slow(정지 입자)는 바탕에 가깝게 가라앉혀 점 무늬가 두드러지지 않게 하고, 움직이는 흐름(fast)과 반짝임(glint)만 파랗게 빛난다
const PALETTE = {
  light: { background: "#1b2342", slow: "#232f5c", fast: "#4a93ff", glint: "#cfe8ff" },
  dark: { background: "#0a0d16", slow: "#121a35", fast: "#2f7cf6", glint: "#a9dcff" },
} as const;

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const compute = () => {
      const t = root.getAttribute("data-theme");
      setDark(t === "dark" || (t !== "light" && mq.matches));
    };
    compute();
    mq.addEventListener("change", compute);
    const mo = new MutationObserver(compute);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", compute);
      mo.disconnect();
    };
  }, []);
  return dark;
}

export function LoginBackdrop() {
  const dark = useDarkMode();
  const c = dark ? PALETTE.dark : PALETTE.light;
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
      <NebulaDrift
        background={c.background}
        colors={{ slow: c.slow, fast: c.fast, glint: c.glint }}
        particles={{ count: 5, size: 1.3, inertia: 2 }}
        dye={{ show: true, fade: 4 }}
        strength={4}
        detail={4}
        iterations={14}
        style={{ pointerEvents: "auto" }}
      />
    </div>
  );
}
