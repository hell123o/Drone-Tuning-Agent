import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";
import type { ReactNode } from "react";

type RunPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function RunPageShell({ title, subtitle, children }: RunPageShellProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,oklch(0.985_0.006_255)_0%,oklch(0.955_0.018_255)_52%,oklch(0.98_0.004_245)_100%)] p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Radar className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
              返回诊断页面
            </Link>
          </div>
        </header>
        <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">{children}</section>
      </div>
    </main>
  );
}
