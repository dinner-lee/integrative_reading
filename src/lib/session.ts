import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "iwl_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

export type Session =
  | { role: "student"; studentId: string; classroomId: string }
  | { role: "teacher"; teacherId: string };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET(32자 이상)가 필요합니다.");
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.role === "student" && typeof payload.studentId === "string") {
      return { role: "student", studentId: payload.studentId, classroomId: String(payload.classroomId) };
    }
    if (payload.role === "teacher" && typeof payload.teacherId === "string") {
      return { role: "teacher", teacherId: payload.teacherId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
