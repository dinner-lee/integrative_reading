import { redirect } from "next/navigation";
import { PeerViewer } from "@/components/workspace/GroupViewer";
import { readSession } from "@/lib/session";

export default async function PeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const s = await readSession();
  if (!s || s.role !== "student") redirect("/");
  const { groupId } = await params;
  const { stage } = await searchParams;
  return <PeerViewer groupId={groupId} initialStage={stage} />;
}
