import { LiveList, LiveMap, LiveObject } from "@liveblocks/client";
import { nanoid } from "nanoid";

export function defaultOutline() {
  const s = (title: string, role: "intro" | "body" | "conclusion", point = "") =>
    new LiveObject({ id: nanoid(8), title, role, point, materialIds: new LiveList<string>([]) });
  return [s("처음", "intro"), s("가운데 1", "body"), s("가운데 2", "body"), s("끝", "conclusion")];
}

export function initialStorage(): Liveblocks["Storage"] {
  return {
    plan: new LiveObject({ topic: "", purpose: "", audience: "", format: "" }),
    memberPlans: new LiveMap(),
    board: new LiveObject({ runId: null, method: null, adoptedAt: 0, adoptedBy: "" }),
    clusters: new LiveList([]),
    decisions: new LiveMap(),
    outline: new LiveList(defaultOutline()),
  };
}
