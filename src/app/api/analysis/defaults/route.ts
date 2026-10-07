import { NextResponse } from "next/server";
import { handle, requireStudent } from "@/lib/auth";
import { analysisGet } from "@/lib/analysis";

export const GET = handle(async () => {
  const st = await requireStudent();
  const d = await analysisGet("/defaults");
  return NextResponse.json({
    stopwords: d.stopwords as string[],
    methods: (d.methods as string[]).filter((m) => st.classroom.enabledMethods.includes(m)),
  });
});
