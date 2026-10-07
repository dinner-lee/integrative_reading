import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import { themeInitScript } from "@/components/ThemeToggle";
import "./globals.css";

const TITLE = "엮어 쓰기";
const DESCRIPTION = "모은 자료를 텍스트 마이닝으로 묶어 보고, 모둠이 함께 고르고 배치해 한 편의 글로 엮는 주제 통합적 읽기와 글쓰기 수업 도구";

export const metadata: Metadata = {
  title: { default: `${TITLE}: 자료를 묶고 함께 쓰는 글쓰기`, template: `%s | ${TITLE}` },
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "ko_KR", siteName: TITLE },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#141416" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* 자체 제공 Pretendard: 글자 범위별 subset 92개를 @font-face로 묶은 정적 CSS(public/)라 번들러를 거치지 않는다 */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className="min-h-full">
        <Providers>
          <div>{children}</div>
        </Providers>
      </body>
    </html>
  );
}
