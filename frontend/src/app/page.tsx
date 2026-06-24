"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { WizardStepper } from "@/features/wizard/wizard-stepper";
import { StepDescribe } from "@/features/wizard/step-describe";
import { StepRunning } from "@/features/wizard/step-running";
import { StepUpload } from "@/features/wizard/step-upload";
import { useDiagnosisSubmission } from "@/features/wizard/use-diagnosis-submission";
import { useWizardState } from "@/features/wizard/use-wizard-state";

export default function Home() {
  const router = useRouter();
  const wizard = useWizardState();
  const [showRunning, setShowRunning] = useState(false);

  const submission = useDiagnosisSubmission((runId) => {
    router.push(`/runs/${encodeURIComponent(runId)}`);
  });

  function handleStart() {
    wizard.next();
    setShowRunning(true);
    void submission.submit(wizard.form);
  }

  function handleAbandon() {
    submission.abandon();
    setShowRunning(false);
    wizard.reset();
  }

  function handleRetry() {
    submission.abandon();
    setShowRunning(false);
    wizard.reset();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <WizardStepper current={showRunning ? "running" : wizard.step} />

      {showRunning || wizard.step === "running" ? (
        <StepRunning
          progress={submission.progress}
          clientStatus={submission.clientStatus}
          activeRunId={submission.activeRunId}
          error={submission.error}
          onAbandon={handleAbandon}
          onRetry={handleRetry}
        />
      ) : wizard.step === "upload" ? (
        <StepUpload wizard={wizard} />
      ) : (
        <StepDescribe wizard={wizard} onExplicitStart={handleStart} />
      )}
    </div>
  );
}
