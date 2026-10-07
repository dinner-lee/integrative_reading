import { redirect } from "next/navigation";
import { TeacherHome } from "@/components/teacher/TeacherHome";
import { getTeacher } from "@/lib/auth";

export default async function TeacherPage() {
  const t = await getTeacher();
  if (!t) redirect("/teacher/login");
  return <TeacherHome teacher={t} />;
}
