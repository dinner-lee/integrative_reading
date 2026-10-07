import { ArrowUpRight, Shapes } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";
import { LandingPreview } from "@/components/landing/Preview";
import { ThemeToggle } from "@/components/ThemeToggle";
import { STAGES } from "@/lib/stages";

const GROUPS = [
  { title: "자료를 모으고 묶기", stages: STAGES.slice(0, 4), offset: 0 },
  { title: "글로 엮기", stages: STAGES.slice(4), offset: 4 },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="pill-bar flex h-11 items-center gap-2 pl-1.5 pr-4 text-[15px] font-semibold">
            <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-[9px]" priority />
            엮어 쓰기
          </Link>
          <nav className="pill-bar flex h-11 items-center gap-1 p-1" aria-label="주 메뉴">
            <a href="#stages" className="pressable hidden rounded-full px-3.5 text-sm text-ink-2 hover:text-ink sm:block">
              일곱 단계
            </a>
            <ThemeToggle className="h-9 bg-transparent p-0" />
            <Link href="/teacher/login" className="pressable flex h-9 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-accent-hover">
              교사 화면 <ArrowUpRight size={15} />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
        <section className="grid items-center gap-12 pt-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:pt-20">
          <div className="max-w-xl">
            <span className="pill-bar inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium">
              <Shapes size={15} /> 자료를 묶고 함께 쓰는 글쓰기
            </span>
            <h1 className="display mt-7 text-ink">
              모으고. 묶고.
              <br />
              함께 글로 엮어요.
            </h1>
            <p className="lede mt-6 max-w-[34ch] text-ink-2">모은 자료를 컴퓨터가 어떻게 묶는지 살펴보고, 글의 목적에 맞는 자료를 모둠이 함께 골라 한 편의 글로 완성해요.</p>
            <div className="mt-9">
              <JoinForm inline />
            </div>
          </div>
          <div className="lg:pl-8">
            <LandingPreview />
          </div>
        </section>

        <section id="stages" className="mt-28 scroll-mt-24 lg:mt-40" aria-labelledby="stages-title">
          <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
            <div className="flex flex-col items-start gap-3">
              <span className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs tabular-nums text-ink-2">01 / 07</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">일곱 단계</span>
            </div>
            <h2 id="stages-title" className="max-w-[22ch] text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.12] tracking-[-0.025em]">
              자료는 많고, 글에 쓸 것은 적어요. <span className="text-ink-3">컴퓨터가 묶어 주면 고르고 엮는 건 우리 몫이에요.</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2 lg:ml-[212px]">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <h3 className="mb-4 text-sm font-semibold text-ink-3">{g.title}</h3>
                <ol className="space-y-3">
                  {g.stages.map((s, i) => {
                    const n = g.offset + i + 1;
                    return (
                      <li key={s.key} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
                        <span className="h-fit shrink-0 rounded-full bg-paper-2 px-2.5 py-1 font-mono text-xs tabular-nums text-ink-2">{String(n).padStart(2, "0")}</span>
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
    </div>
  );
}
