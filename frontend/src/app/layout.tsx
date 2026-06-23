import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drone Tuning Agent",
  description: "X760 flight log diagnosis and parameter tuning UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
