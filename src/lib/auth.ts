import "server-only";
import { NextResponse } from "next/server";
import { db } from "./db";
import { readSession } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 라우트 핸들러 공통 오류 처리 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ error: "서버에서 문제가 생겼어요. 잠시 뒤 다시 해 보세요." }, { status: 500 });
    }
  };
}

export async function getStudentContext() {
  const s = await readSession();
  if (!s || s.role !== "student") return null;
  const student = await db.student.findUnique({
    where: { id: s.studentId },
    include: { classroom: true, group: true },
  });
  if (!student || student.classroom.archived) return null;
  return student;
}

export type StudentContext = NonNullable<Awaited<ReturnType<typeof getStudentContext>>>;

export async function requireStudent() {
  const st = await getStudentContext();
  if (!st) throw new ApiError(401, "다시 입장해 주세요.");
  return st;
}

/** 모둠이 정해진 학생만 */
export async function requireGroupedStudent() {
  const st = await requireStudent();
  if (!st.groupId || !st.group) throw new ApiError(403, "아직 모둠이 정해지지 않았어요.");
  return st as StudentContext & { groupId: string; group: NonNullable<StudentContext["group"]> };
}

export async function getTeacher() {
  const s = await readSession();
  if (!s || s.role !== "teacher") return null;
  return db.teacher.findUnique({ where: { id: s.teacherId }, select: { id: true, name: true, email: true } });
}

export async function requireTeacher() {
  const t = await getTeacher();
  if (!t) throw new ApiError(401, "교사 로그인이 필요해요.");
  return t;
}

export async function requireOwnClassroom(classroomId: string) {
  const t = await requireTeacher();
  const c = await db.classroom.findFirst({ where: { id: classroomId, teacherId: t.id } });
  if (!c) throw new ApiError(404, "학급을 찾을 수 없어요.");
  return { teacher: t, classroom: c };
}

/**
 * 모둠 자료를 읽을 수 있는지: 본인 모둠, 같은 학급에서 다른 모둠 보기가 허용된 경우, 담당 교사.
 * 쓰기 권한(write)은 본인 모둠과 교사만.
 */
export async function authorizeGroup(groupId: string, mode: "read" | "write") {
  const group = await db.group.findUnique({ where: { id: groupId }, include: { classroom: true } });
  if (!group) throw new ApiError(404, "모둠을 찾을 수 없어요.");
  const s = await readSession();
  if (s?.role === "teacher" && group.classroom.teacherId === s.teacherId) {
    return { group, actor: { type: "teacher" as const, id: s.teacherId } };
  }
  const st = await getStudentContext();
  if (!st || st.classroomId !== group.classroomId) throw new ApiError(403, "볼 수 없는 모둠이에요.");
  const own = st.groupId === groupId;
  if (!own && (mode === "write" || !group.classroom.allowPeerView)) {
    throw new ApiError(403, "다른 모둠의 자료는 고칠 수 없어요.");
  }
  return { group, actor: { type: "student" as const, id: st.id, name: st.name }, student: st, own };
}
