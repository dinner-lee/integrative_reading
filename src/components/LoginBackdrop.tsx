"use client";

import { useEffect, useState } from "react";
import FlowField from "./FlowField";

/**
 * 로그인·학급 입장 화면의 배경: 화면 전체에 깔리는 Flow Field(새틴 결 무늬).
 * 밝은 모드는 Originkit 프리셋 그대로(연회색 바탕 + 앱 강조색 계열 파랑 결), 어두운 모드는 깊은 남색 바탕.
 * 움직임 줄이기 설정이면 속도 0으로 정지 화면만 둔다.
 */
const PALETTE = {
  light: { background: "#F0F1F2", baseColor: "#3E77D8", accentColor: "#BBD4FF" },
  dark: { background: "#0A1330", baseColor: "#2F5FC4", accentColor: "#9CC2FF" },
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

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function LoginBackdrop() {
  const dark = useDarkMode();
  const reduced = useReducedMotion();
  const c = dark ? PALETTE.dark : PALETTE.light;
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
      <FlowField
        variant="satin"
        background={c.background}
        baseColor={c.baseColor}
        accentColor={c.accentColor}
        speed={reduced ? 0 : 100}
        hover={10}
        // 원본은 최소 1200×800을 강제하므로 전체 화면 배경용으로 푼다
        style={{ position: "absolute", inset: 0, minWidth: 0, minHeight: 0, width: "100%", height: "100%", pointerEvents: "auto" }}
      />
    </div>
  );
}
