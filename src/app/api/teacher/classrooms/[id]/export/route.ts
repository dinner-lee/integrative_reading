import { NextResponse } from "next/server";
import { ApiError, handle, requireOwnClassroom } from "@/lib/auth";
import { db } from "@/lib/db";
import { latestDrafts, readBoard } from "@/lib/teacher-data";

type Ctx = { params: Promise<{ id: string }> };

function csv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // 엑셀에서 한글이 깨지지 않도록 BOM
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

function file(body: string, name: string, type: string) {
  return new NextResponse(body, {
    headers: {
      "content-type": `${type}; charset=utf-8`,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}

/** GET ?type=events|materials|runs|boards|drafts|reflections */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { classroom } = await requireOwnClassroom(id);
  const type = new URL(req.url).searchParams.get("type") ?? "events";
  const groups = await db.group.findMany({ where: { classroomId: id }, select: { id: true, name: true } });
  const gname = new Map(groups.map((g) => [g.id, g.name]));
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${classroom.name}_${stamp}`;

  if (type === "events") {
    const events = await db.eventLog.findMany({ where: { classroomId: id }, orderBy: { id: "asc" } });
    return file(
      csv([
        ["id", "server_time", "client_time", "group", "actor_type", "actor_id", "actor_name", "stage", "type", "payload"],
        ...events.map((e) => [
          e.id.toString(),
          e.createdAt.toISOString(),
          e.clientAt?.toISOString(),
          e.groupId ? gname.get(e.groupId) : "",
          e.actorType,
          e.actorId,
          e.actorName,
          e.stage,
          e.type,
          JSON.stringify(e.payload ?? {}),
        ]),
      ]),
      `${base}_활동로그.csv`,
      "text/csv",
    );
  }

  if (type === "materials") {
    const materials = await db.material.findMany({
      where: { classroomId: id },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return file(
      csv([
        ["id", "group", "author", "online", "media", "title", "url", "source", "published", "input", "file", "extracted_chars", "chars", "note", "content", "created", "deleted"],
        ...materials.map((m) => [
          m.id,
          gname.get(m.groupId),
          m.author?.name,
          m.isOnline ? "온라인" : "오프라인",
          m.mediaType,
          m.title,
          m.url,
          m.source,
          m.publishedAt,
          m.inputMethod,
          m.fileName,
          m.extractedChars,
          m.content.length,
          m.note,
          m.content,
          m.createdAt.toISOString(),
          m.deletedAt?.toISOString(),
        ]),
      ]),
      `${base}_자료.csv`,
      "text/csv",
    );
  }

  if (type === "runs") {
    const runs = await db.analysisRun.findMany({
      where: { group: { classroomId: id } },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return file(
      JSON.stringify(
        runs.map((r) => ({ ...r, group: gname.get(r.groupId) })),
        null,
        2,
      ),
      `${base}_분석기록.json`,
      "application/json",
    );
  }

  if (type === "boards") {
    const boards = await Promise.all(
      groups.map(async (g) => ({ group: g.name, groupId: g.id, storage: await readBoard(id, g.id) })),
    );
    return file(JSON.stringify(boards, null, 2), `${base}_모둠보드.json`, "application/json");
  }

  if (type === "drafts") {
    const drafts = await latestDrafts(id);
    const students = await db.student.findMany({ where: { classroomId: id }, select: { id: true, name: true } });
    const sname = new Map(students.map((s) => [`draft-s-${s.id}`, s.name]));
    return file(
      csv([
        ["group", "field", "owner", "chars", "saved_at", "last_editor", "text"],
        ...drafts.map((d) => [
          d.groupId ? gname.get(d.groupId) : "",
          d.field,
          d.field === "draft-group" ? "모둠" : sname.get(d.field),
          d.chars,
          d.at.toISOString(),
          d.by,
          d.text,
        ]),
      ]),
      `${base}_초고.csv`,
      "text/csv",
    );
  }

  if (type === "reflections") {
    const rows = await db.reflection.findMany({
      where: { student: { classroomId: id } },
      include: { student: { select: { name: true, groupId: true } } },
    });
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r.answers as object)))];
    return file(
      csv([
        ["group", "student", "updated", ...keys],
        ...rows.map((r) => [
          r.student.groupId ? gname.get(r.student.groupId) : "",
          r.student.name,
          r.updatedAt.toISOString(),
          ...keys.map((k) => (r.answers as Record<string, string>)[k]),
        ]),
      ]),
      `${base}_성찰.csv`,
      "text/csv",
    );
  }

  throw new ApiError(400, "알 수 없는 내보내기 종류예요.");
});
