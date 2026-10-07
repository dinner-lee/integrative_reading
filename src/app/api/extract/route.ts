import { NextResponse } from "next/server";
import { ApiError, handle, requireGroupedStudent } from "@/lib/auth";
import { analysisExtract } from "@/lib/analysis";
import { logEvent } from "@/lib/log";

const ALLOWED = [".pdf", ".docx", ".pptx", ".hwpx", ".txt", ".md", ".html"];

/** 파일을 텍스트로 바꾼다(markitdown). 파일 자체는 저장하지 않는다. */
export const POST = handle(async (req: Request) => {
  const st = await requireGroupedStudent();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "파일을 골라 주세요.");
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED.includes(ext)) throw new ApiError(400, `올릴 수 있는 파일: ${ALLOWED.join(", ")}`);
  if (file.size > 20 * 1024 * 1024) throw new ApiError(413, "파일이 너무 커요(최대 20MB).");

  const result = await analysisExtract(file);
  await logEvent({
    classroomId: st.classroomId,
    groupId: st.groupId,
    actorType: "student",
    actorId: st.id,
    actorName: st.name,
    stage: "collect",
    type: "material.extract",
    payload: { fileName: file.name, bytes: file.size, chars: result.chars, empty: !result.text?.trim() },
  });
  return NextResponse.json(result);
});
