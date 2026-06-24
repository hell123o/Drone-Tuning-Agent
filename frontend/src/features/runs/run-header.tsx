import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { formatDuration, formatRunTime, statusColor } from "./run-utils.mjs";
import type { RunStatus } from "./types";

export function RunHeader({ run }: { run: RunStatus }) {
  const aircraft = run.metadata?.testAircraft ?? "";
  const duration = formatDuration(run.startedAt, run.finishedAt);

  return (
    <div className="space-y-2">
      <Link
        href="/runs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 返回历史
      </Link>
      <div className="flex items-center gap-3">
        <span className={"size-2 rounded-full " + statusColor(run.state)} />
        <h1 className="font-mono text-xl font-semibold tracking-tight">{run.runId}</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {[aircraft, formatRunTime(run.startedAt), duration].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
