import type { Metadata } from "next";
import { JoinForm } from "@/components/JoinForm";
import { Logo } from "@/components/Logo";
import { db } from "@/lib/db";

// 초대 코드가 주소에 들어 있으므로 검색에 노출하지 않는다
export const metadata: Metadata = { title: "학급 입장", robots: { index: false, follow: false } };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const classroom = await db.classroom.findUnique({
    where: { inviteCode: code.toUpperCase() },
    select: { name: true, archived: true },
  });

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm card p-7 sm:p-8">
        {classroom && !classroom.archived ? (
          <>
            <Logo size={28} wordmark />
            <h1 className="mt-1 text-xl font-bold">{classroom.name}</h1>
            <p className="mb-5 mt-1 text-sm text-ink-3">이름을 쓰고 들어가세요.</p>
            <JoinForm initialCode={code.toUpperCase()} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">초대 링크가 맞지 않아요</h1>
            <p className="mt-2 text-sm text-ink-2">링크가 바뀌었거나 수업이 끝났을 수 있어요. 선생님께 새 코드를 받아 주세요.</p>
            <div className="mt-5">
              <JoinForm />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
