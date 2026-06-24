import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { isPathInside, RUNS_ROOT } from "@/lib/server/paths";
import { RunHeader } from "@/features/runs/run-header";
import { RunDetailClient } from "@/features/runs/run-detail-client";
import type { RunStatus } from "@/features/runs/types";

export default async function RunDetailPage({
  params,
}: PageProps<"/runs/[runId]">) {
  const { runId } = await params;
  const runRoot = path.resolve(RUNS_ROOT, runId);
  const statusFile = path.resolve(runRoot, "status.json");

  if (!isPathInside(RUNS_ROOT, runRoot) || !existsSync(statusFile)) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">该诊断记录不存在。</p>
        <Link href="/runs" className="text-primary hover:underline">返回历史列表</Link>
      </div>
    );
  }

  const run = JSON.parse(readFileSync(statusFile, "utf-8")) as RunStatus;

  let reportText = "";
  if (run.reportUrl) {
    const reportPath = path.resolve(runRoot, "diagnosis.md");
    if (existsSync(reportPath)) {
      reportText = readFileSync(reportPath, "utf-8");
    }
  }

  let paramsPreview = "";
  if (run.paramsUrl) {
    const paramsPath = path.resolve(runRoot, "diagnosis_recommendations.params");
    if (existsSync(paramsPath)) {
      paramsPreview = readFileSync(paramsPath, "utf-8");
    }
  }

  return (
    <div className="space-y-8">
      <RunHeader run={run} />
      <RunDetailClient run={run} reportText={reportText} paramsPreview={paramsPreview} />
    </div>
  );
}
