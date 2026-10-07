import { redirect } from "next/navigation";
import { TeacherGroupViewer } from "@/components/workspace/GroupViewer";
import { getTeacher } from "@/lib/auth";

export default async function TeacherGroupPage({ params }: { params: Promise<{ id: string; groupId: string }> }) {
  const t = await getTeacher();
  if (!t) redirect("/teacher/login");
  const { groupId } = await params;
  return <TeacherGroupViewer groupId={groupId} teacher={{ id: t.id, name: t.name }} />;
}
