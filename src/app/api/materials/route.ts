import { NextResponse } from "next/server";
import { ApiError, authorizeGroup, handle, requireGroupedStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { MaterialInput, materialSelect } from "./schema";

/** GET /api/materials?groupId=... (생략하면 내 모둠) */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  let groupId = url.searchParams.get("groupId");
  if (!groupId) groupId = (await requireGroupedStudent()).groupId;
  await authorizeGroup(groupId, "read");
  const materials = await db.material.findMany({
    where: { groupId, deletedAt: null },
    select: materialSelect,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ materials });
});

export const POST = handle(async (req: Request) => {
  const st = await requireGroupedStudent();
  const parsed = MaterialInput.safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.");
  const material = await db.material.create({
    data: { ...parsed.data, classroomId: st.classroomId, groupId: st.groupId, authorId: st.id },
    select: materialSelect,
  });
  await logEvent({
    classroomId: st.classroomId,
    groupId: st.groupId,
    actorType: "student",
    actorId: st.id,
    actorName: st.name,
    stage: "collect",
    type: "material.create",
    payload: {
      materialId: material.id,
      title: material.title,
      isOnline: material.isOnline,
      mediaType: material.mediaType,
      inputMethod: material.inputMethod,
      chars: material.content.length,
      extractedChars: material.extractedChars,
      hasNote: Boolean(material.note),
    },
  });
  return NextResponse.json({ material });
});
