"use client";

import { AppHeader } from "@/features/diagnosis/app-header";
import { DiagnosisForm } from "@/features/diagnosis/diagnosis-form";
import { ResultTabs } from "@/features/diagnosis/result-tabs";
import { useDiagnosisRun } from "@/features/diagnosis/use-diagnosis-run";

export default function Home() {
  const diagnosis = useDiagnosisRun();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,oklch(0.985_0.006_255)_0%,oklch(0.955_0.018_255)_48%,oklch(0.98_0.004_245)_100%)] text-foreground">
      <section className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <AppHeader loading={diagnosis.loading} hasResult={Boolean(diagnosis.result)} progress={diagnosis.progress} />
        <div className="grid min-h-[calc(100vh-180px)] gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
          <DiagnosisForm diagnosis={diagnosis} />
          <section className="min-w-0">
            <ResultTabs diagnosis={diagnosis} />
          </section>
        </div>
      </section>
    </main>
  );
}
