import { redirect } from "next/navigation";
import { ClassroomAdmin } from "@/components/teacher/ClassroomAdmin";
import { getTeacher } from "@/lib/auth";

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTeacher();
  if (!t) redirect("/teacher/login");
  const { id } = await params;
  return <ClassroomAdmin classroomId={id} />;
}
