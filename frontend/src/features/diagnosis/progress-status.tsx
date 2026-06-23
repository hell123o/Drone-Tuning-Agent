import { CircleDot } from "lucide-react";

import { clampProgress } from "./client-utils.mjs";

type ProgressStatusProps = {
  clientStatus: string;
  progress: number;
  activeRunId: string;
};

export function ProgressStatus({ clientStatus, progress, activeRunId }: ProgressStatusProps) {
  const boundedProgress = clampProgress(progress);

  return (
    <div className="space-y-3 rounded-xl border bg-muted/35 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CircleDot className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 text-muted-foreground">{clientStatus}</span>
        </div>
        <span className="shrink-0 font-mono text-xs font-medium text-foreground">{Math.round(boundedProgress)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${boundedProgress}%` }} />
      </div>
      {activeRunId ? <div className="truncate font-mono text-[11px] text-muted-foreground">Run ID: {activeRunId}</div> : null}
    </div>
  );
}
