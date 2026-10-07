import { JoinForm } from "@/components/JoinForm";
import { db } from "@/lib/db";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const classroom = await db.classroom.findUnique({
    where: { inviteCode: code.toUpperCase() },
    select: { name: true, archived: true },
  });

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-7">
        {classroom && !classroom.archived ? (
          <>
            <p className="text-sm font-semibold text-accent">엮어 쓰기</p>
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
