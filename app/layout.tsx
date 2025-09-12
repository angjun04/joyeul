import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "조율 - 팀 일정 조율 서비스",
  description: "모두가 가능한 시간을 쉽고 빠르게 찾아보세요. 실시간으로 팀원들의 일정을 조율하는 웹 서비스입니다.",
  keywords: "일정 조율, 팀 미팅, 시간 맞추기, 일정 관리",
  authors: [{ name: "조율 Team" }],
  openGraph: {
    title: "조율 - 팀 일정 조율 서비스",
    description: "모두가 가능한 시간을 쉽고 빠르게 찾아보세요.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
