/** 묶음 색 (분석 결과·보드·첫 화면 미리보기 공통). 서버·클라이언트 어디서나 쓸 수 있다. */
export const CLUSTER_COLORS = ["#2f5bea", "#e4572e", "#1b998b", "#c77d00", "#8e44ad", "#d6336c", "#2d6a4f", "#5f6c7b", "#0081a7", "#a0522d", "#6d597a", "#3d5a80"];

export function clusterColor(i: number) {
  return CLUSTER_COLORS[((i % CLUSTER_COLORS.length) + CLUSTER_COLORS.length) % CLUSTER_COLORS.length];
}
