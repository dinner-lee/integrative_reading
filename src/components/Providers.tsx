"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { DialogProvider } from "./dialogs";
import { springs } from "./motion";
import { ToastProvider } from "./toast";

/** 모션 기본값(임계 감쇠 스프링, 시스템 감소 동작 존중) + 토스트 + 대화상자 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={springs.default}>
      <ToastProvider>
        <DialogProvider>{children}</DialogProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
