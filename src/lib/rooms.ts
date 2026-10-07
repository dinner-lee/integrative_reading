/** Liveblocks 방 이름 규칙: 모둠마다 방 하나 */
export function groupRoomId(classroomId: string, groupId: string) {
  return `c:${classroomId}:g:${groupId}`;
}

export function parseRoomId(roomId: string) {
  const m = /^c:([^:]+):g:([^:]+)$/.exec(roomId);
  return m ? { classroomId: m[1], groupId: m[2] } : null;
}

/** 공동 편집기 field 이름 */
export const GROUP_DRAFT_FIELD = "draft-group";
export function studentDraftField(studentId: string) {
  return `draft-s-${studentId}`;
}

const COLORS = ["#e4572e", "#1b998b", "#3a86ff", "#c08497", "#ff9f1c", "#6a4c93", "#2d6a4f", "#d00070", "#0081a7", "#8d6e63"];

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}
