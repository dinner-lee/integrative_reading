import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";
import { LandingPreview } from "@/components/landing/Preview";
import { ThemeToggle } from "@/components/ThemeToggle";
import { STAGES } from "@/lib/stages";

const GROUPS = [
  { title: "자료를 모으고 묶기", stages: STAGES.slice(0, 4) },
  { title: "글로 엮기", stages: STAGES.slice(4) },
];

export default function Home() {
  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
      <section className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div>
          <p className="text-sm font-semibold text-accent">주제 통합적 읽기와 정보 전달 글쓰기</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">엮어 쓰기</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
            모은 자료를 컴퓨터가 어떻게 묶는지 살펴보고, 글의 목적과 독자에 맞는 자료를 모둠이 함께 골라 한 편의 글로 엮어요.
          </p>
          <div className="mt-8">
            <LandingPreview />
          </div>
        </div>

        <aside className="rounded-xl border border-line bg-surface p-6 shadow-card sm:p-7 lg:sticky lg:top-10">
          <h2 className="text-lg font-bold">학생 입장</h2>
          <p className="mb-5 mt-1 text-sm text-ink-3">초대 코드와 이름만 있으면 돼요.</p>
          <JoinForm />
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm text-ink-3">
            <span>
              선생님이신가요?{" "}
              <Link href="/teacher/login" className="font-semibold text-accent hover:underline">
                교사 화면으로
              </Link>
            </span>
            <ThemeToggle />
          </div>
        </aside>
      </section>

      <section className="mt-16 lg:mt-20" aria-labelledby="stages-title">
        <h2 id="stages-title" className="text-2xl font-bold tracking-tight">
          일곱 단계로 진행해요
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">선생님이 단계를 열면 모둠 공간에서 차례로 활동해요. 앞 단계에서 정리한 내용은 다음 단계 옆에 늘 보여요.</p>
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          {GROUPS.map((g, gi) => (
            <div key={g.title}>
              <h3 className="mb-3 text-sm font-semibold text-ink-3">{g.title}</h3>
              <ol className="divide-y divide-line border-t border-line">
                {g.stages.map((s, i) => {
                  const n = (gi === 0 ? 0 : GROUPS[0].stages.length) + i + 1;
                  return (
                    <li key={s.key} className="flex gap-4 py-4">
                      <span className="w-6 shrink-0 text-lg font-bold tabular-nums text-accent">{n}</span>
                      <div>
                        <p className="font-semibold">{s.label}</p>
                        <p className="mt-0.5 text-sm leading-snug text-ink-2">{s.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
