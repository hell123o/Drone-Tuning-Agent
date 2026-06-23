import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drone Tuning Agent",
  description: "无人机飞行日志诊断与调参工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-sidebar lg:block">
            <div className="p-6 text-sm text-muted-foreground">侧边栏占位</div>
          </aside>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
