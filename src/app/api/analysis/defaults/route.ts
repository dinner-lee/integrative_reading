import { NextResponse } from "next/server";
import { handle, requireStudent } from "@/lib/auth";
import { analysisGet } from "@/lib/analysis";

// 불용어 기본값·방법 목록은 거의 바뀌지 않으므로 서버 메모리에 잠시 둔다 (분석 서버 왕복 1초 남짓을 없앤다)
let cached: { at: number; data: { stopwords: string[]; methods: string[] } } | null = null;
const TTL = 10 * 60 * 1000;

async function serverDefaults() {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const d = await analysisGet("/defaults");
  cached = { at: Date.now(), data: { stopwords: d.stopwords as string[], methods: d.methods as string[] } };
  return cached.data;
}

export const GET = handle(async () => {
  const [st, d] = await Promise.all([requireStudent(), serverDefaults()]);
  return NextResponse.json({
    stopwords: d.stopwords as string[],
    methods: (d.methods as string[]).filter((m) => st.classroom.enabledMethods.includes(m)),
  });
});
