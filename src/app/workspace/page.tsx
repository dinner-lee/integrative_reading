import { redirect } from "next/navigation";
import { StudentWorkspace } from "@/components/workspace/StudentWorkspace";
import { readSession } from "@/lib/session";

export default async function WorkspacePage() {
  const s = await readSession();
  if (!s || s.role !== "student") redirect("/");
  return <StudentWorkspace />;
}
