import { existsSync, readFileSync } from "node:fs";

import { RunChartsGrid } from "@/features/runs/run-charts-grid";
import { RunDownloadLinks } from "@/features/runs/run-download-links";
import { RunMetadata } from "@/features/runs/run-metadata";
import { RunPageShell } from "@/features/runs/run-page-shell";
import type { RunArtifact } from "@/features/runs/types";
import { LATEST_FILE } from "@/lib/server/paths";

export const dynamic = "force-dynamic";

export default function LatestPage() {
  const latest: RunArtifact | null = existsSync(LATEST_FILE)
    ? JSON.parse(readFileSync(LATEST_FILE, "utf-8"))
    : null;

  return (
    <RunPageShell title="最近一次诊断结果">
      {!latest ? (
        <p className="text-muted-foreground">还没有诊断结果。</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Run ID: {latest.runId}</p>
          <p className="text-sm text-muted-foreground">完成时间: {latest.finishedAt ?? "未知"}</p>
          <RunMetadata metadata={latest.metadata} />
          <RunDownloadLinks run={latest} />
          <RunChartsGrid charts={latest.charts} chartDataUrl={latest.chartDataUrl} />
        </div>
      )}
    </RunPageShell>
  );
}
