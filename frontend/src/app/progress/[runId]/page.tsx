import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { RunChartsGrid } from "@/features/runs/run-charts-grid";
import { RunDownloadLinks } from "@/features/runs/run-download-links";
import { RunMetadata } from "@/features/runs/run-metadata";
import { RunPageShell } from "@/features/runs/run-page-shell";
import type { RunStatus } from "@/features/runs/types";
import { isPathInside, RUNS_ROOT } from "@/lib/server/paths";

export const dynamic = "force-dynamic";

export default async function ProgressPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const runRoot = path.resolve(RUNS_ROOT, runId);
  const statusFile = path.resolve(runRoot, "status.json");
  const canReadRun = isPathInside(RUNS_ROOT, runRoot) && isPathInside(runRoot, statusFile);
  const status: RunStatus =
    canReadRun && existsSync(statusFile)
      ? JSON.parse(readFileSync(statusFile, "utf-8"))
      : { runId, state: "running", step: "任务已提交，等待服务器创建状态文件...", progress: 1 };
  const metadataFile = path.resolve(runRoot, "test_metadata.json");
  const metadata =
    status.metadata ||
    (canReadRun && existsSync(metadataFile) ? JSON.parse(readFileSync(metadataFile, "utf-8")) : undefined);

  const progress = Math.max(0, Math.min(100, status.progress ?? 0));
  const done = status.state === "done";
  const failed = status.state === "error";

  return (
    <RunPageShell title="诊断进度" subtitle={`Run ID: ${runId}`}>
      {!done && !failed ? <meta httpEquiv="refresh" content="2" /> : null}

      <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex justify-between text-sm">
          <span>{status.step ?? "诊断运行中..."}</span>
          <span className="font-mono">{Math.round(progress)}%</span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          状态：{status.state ?? "running"}，更新时间：{status.updatedAt ?? "未知"}
        </p>
      </div>

      <RunMetadata metadata={metadata} />

      {failed ? (
        <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <h2 className="text-xl font-semibold">诊断失败</h2>
          <pre className="whitespace-pre-wrap text-xs">
            {status.error || status.stderrTail || status.stdoutTail || "未知错误"}
          </pre>
        </div>
      ) : null}

      {done ? (
        <div className="space-y-5">
          <RunDownloadLinks run={status} />
          <RunChartsGrid charts={status.charts} chartDataUrl={status.chartDataUrl} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">页面会每 2 秒自动刷新。日志较大时请等待，不要重复提交。</p>
      )}
    </RunPageShell>
  );
}
