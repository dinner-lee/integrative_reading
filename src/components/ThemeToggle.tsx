"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { clsx } from "./ui";

type Theme = "system" | "light" | "dark";
const KEY = "iwl-theme";

/** 화면 모드: 시스템 설정을 따르거나 밝게·어둡게 고정 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as Theme | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장된 선택을 읽어 온다
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* 저장소를 못 읽어도 시스템 설정으로 동작 */
    }
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 350);
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    try {
      if (next === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      /* 무시 */
    }
  }

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: "시스템 설정", icon: <Monitor size={14} /> },
    { value: "light", label: "밝게", icon: <Sun size={14} /> },
    { value: "dark", label: "어둡게", icon: <Moon size={14} /> },
  ];

  return (
    <div role="radiogroup" aria-label="화면 모드" className={clsx("inline-flex h-10 items-center rounded-full bg-paper-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => apply(o.value)}
          className={clsx(
            "pressable flex h-8 w-8 items-center justify-center rounded-full",
            theme === o.value ? "pill-thumb text-ink" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

/** 첫 그리기 전에 저장된 모드를 적용해 깜빡임을 막는다 */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
