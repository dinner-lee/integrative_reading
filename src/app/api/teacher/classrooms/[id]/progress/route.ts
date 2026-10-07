import { NextResponse } from "next/server";
import { handle, requireOwnClassroom } from "@/lib/auth";
import { db } from "@/lib/db";
import { groupRoomId } from "@/lib/rooms";
import { latestDrafts, readBoard } from "@/lib/teacher-data";

type Ctx = { params: Promise<{ id: string }> };

/** 모둠별 진행 현황 */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireOwnClassroom(id);
  const groups = await db.group.findMany({
    where: { classroomId: id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      students: { select: { id: true, name: true, lastSeenAt: true } },
      _count: { select: { materials: { where: { deletedAt: null } }, runs: true } },
    },
  });
  const drafts = await latestDrafts(id);
  const lastEvents = await db.eventLog.groupBy({
    by: ["groupId"],
    where: { classroomId: id },
    _max: { createdAt: true },
  });

  const rows = await Promise.all(
    groups.map(async (g) => {
      const board = await readBoard(id, g.id);
      const decisions = Object.values(board.decisions ?? {});
      const count = (s: string) => decisions.filter((d) => d.status === s).length;
      const groupDrafts = drafts.filter((d) => d.groupId === g.id);
      return {
        id: g.id,
        name: g.name,
        roomId: groupRoomId(id, g.id),
        students: g.students,
        materials: g._count.materials,
        runs: g._count.runs,
        topic: board.plan?.topic ?? "",
        adoptedRun: board.board?.runId ?? null,
        clusters: (board.clusters ?? []).length,
        namedClusters: (board.clusters ?? []).filter((c) => c.name.trim()).length,
        decisions: { selected: count("selected"), hold: count("hold"), excluded: count("excluded") },
        outlineSections: (board.outline ?? []).length,
        outlinePlaced: new Set((board.outline ?? []).flatMap((s) => s.materialIds)).size,
        draftChars: groupDrafts.reduce((a, d) => a + d.chars, 0),
        lastActivity: lastEvents.find((e) => e.groupId === g.id)?._max.createdAt ?? null,
      };
    }),
  );
  return NextResponse.json({ groups: rows });
});
