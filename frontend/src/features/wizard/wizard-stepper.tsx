// src/features/wizard/wizard-stepper.tsx
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WizardStep } from "./types";

const STEPS: { value: WizardStep; label: string }[] = [
  { value: "upload", label: "上传日志" },
  { value: "describe", label: "现场描述" },
  { value: "running", label: "运行中" },
];

export function WizardStepper({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.value === current);

  return (
    <div className="flex items-center gap-3">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.value} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px w-12 bg-border/60 sm:w-16" />
            )}
          </div>
        );
      })}
    </div>
  );
}
