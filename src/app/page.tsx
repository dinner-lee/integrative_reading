import { ArrowUpRight, Shapes } from "lucide-react";
import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";
import { LandingPreview } from "@/components/landing/Preview";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="pill-bar flex h-11 items-center pl-2 pr-4">
            <Logo size={30} wordmark />
          </Link>
          <nav aria-label="주 메뉴">
            <Link href="/teacher/login" className="pressable flex h-11 items-center gap-1 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-accent-hover">
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
            <h1 className="display stage-title mt-7 text-ink">
              모으고. 묶고.
              <br />
              함께 글로 풀어내요.
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
      </main>
    </div>
  );
}
