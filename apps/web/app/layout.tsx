import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "求职工作台",
  description: "集中跟踪求职进展、收藏岗位和面试日程。",
  icons: { icon: "/brand-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
