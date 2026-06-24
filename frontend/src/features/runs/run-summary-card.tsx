import Link from "next/link";
import { FileImage, FileSliders, FileText } from "lucide-react";

import { formatRunTime, shortRunId, statusColor } from "./run-utils.mjs";
import type { RunSummary } from "./types";

export function RunSummaryCard({ run }: { run: RunSummary }) {
  const aircraft = run.metadata?.testAircraft ?? "";
  const logName = run.runId.split("_").slice(1).join("_") || run.runId;

  return (
    <Link
      href={`/runs/${run.runId}`}
      className="block rounded-xl border border-border/60 bg-background p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-2">
        <span className={"size-2 shrink-0 rounded-full " + statusColor(run.state)} />
        <span className="font-mono text-sm font-medium">{shortRunId(run.runId)}</span>
        <span className="text-xs text-muted-foreground">· {formatRunTime(run.updatedAt)}</span>
        {run.state === "error" && (
          <span className="ml-auto rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600">失败</span>
        )}
      </div>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">
        {[aircraft, logName].filter(Boolean).join(" · ")}
      </p>
      {run.state === "error" && run.step && (
        <p className="mt-1 truncate text-xs text-rose-500">{run.step}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-muted-foreground">
        {run.hasReport && (
          <span title="有报告">
            <FileText className="size-3.5" />
          </span>
        )}
        {run.hasPdf && (
          <span title="有 PDF">
            <FileText className="size-3.5" />
          </span>
        )}
        {run.hasParams && (
          <span title="有参数文件">
            <FileSliders className="size-3.5" />
          </span>
        )}
        {run.chartsCount > 0 && (
          <span className="flex items-center gap-1 text-xs">
            <FileImage className="size-3.5" /> {run.chartsCount}
          </span>
        )}
      </div>
    </Link>
  );
}
