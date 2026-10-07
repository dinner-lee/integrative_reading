import type { Transition } from "motion/react";

/**
 * 스프링 기본값. Apple의 damping/response를 Motion의 bounce/duration으로 옮겼다.
 * - 기본 UI: 임계 감쇠(bounce 0) 0.35~0.4s. 튀지 않고 가라앉는다.
 * - 손가락 속도가 실린 동작(시트·드래그 놓기)만 살짝 튄다(bounce 0.2).
 */
export const springs = {
  default: { type: "spring", bounce: 0, duration: 0.4 } as Transition,
  quick: { type: "spring", bounce: 0, duration: 0.25 } as Transition,
  sheet: { type: "spring", bounce: 0.2, duration: 0.35 } as Transition,
  drop: { type: "spring", bounce: 0.15, duration: 0.4 } as Transition,
};

/** 놓는 순간의 속도로 어디까지 미끄러질지 투영한다 (UIScrollView 감속과 같은 식). */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** 경계를 넘어 끌수록 덜 따라오게 한다. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
