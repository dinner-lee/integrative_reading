import "server-only";
import { customAlphabet } from "nanoid";
import { db } from "./db";

// 헷갈리는 글자(0/O, 1/I/L) 제외
const gen = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 6);

export async function newInviteCode() {
  for (let i = 0; i < 10; i++) {
    const code = gen();
    const exists = await db.classroom.findUnique({ where: { inviteCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("초대 코드를 만들지 못했어요.");
}
