import "server-only";
import { Liveblocks } from "@liveblocks/node";

let client: Liveblocks | null = null;

export function liveblocks() {
  if (!client) {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) throw new Error("LIVEBLOCKS_SECRET_KEY가 필요합니다.");
    client = new Liveblocks({ secret, baseUrl: process.env.LIVEBLOCKS_BASE_URL || undefined });
  }
  return client;
}
