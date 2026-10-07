import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";
import { STAGES } from "@/lib/stages";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-10 sm:px-6 lg:py-16">
      <div className="grid flex-1 items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <section>
          <p className="text-sm font-semibold text-accent">주제 통합적 읽기 · 정보 전달 글쓰기</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">엮어 쓰기</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
            모은 자료를 컴퓨터가 어떻게 묶는지 살펴보고, 글의 목적과 독자에 맞는 자료를 모둠이 함께 골라 한 편의 글로 엮어요.
          </p>
          <ol className="mt-8 grid max-w-xl gap-2 sm:grid-cols-2">
            {STAGES.map((s, i) => (
              <li key={s.key} className="flex gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#efede6] text-xs font-bold text-ink-2">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{s.label}</span>
                  <span className="block text-[13px] leading-snug text-ink-3">{s.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-7 lg:sticky lg:top-10">
          <h2 className="text-lg font-bold">학생 입장</h2>
          <p className="mb-5 mt-1 text-sm text-ink-3">초대 코드와 이름만 있으면 돼요.</p>
          <JoinForm />
          <div className="mt-6 border-t border-line pt-4 text-sm text-ink-3">
            선생님이신가요?{" "}
            <Link href="/teacher/login" className="font-semibold text-accent hover:underline">
              교사 화면으로
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
