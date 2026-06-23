import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";

import { isPathInside, RUNS_ROOT } from "@/lib/server/paths";
import type { RunSummary } from "@/features/runs/types";

export async function GET() {
  const runs: RunSummary[] = [];

  if (existsSync(RUNS_ROOT)) {
    const entries = readdirSync(RUNS_ROOT);
    for (const name of entries) {
      const dir = path.resolve(RUNS_ROOT, name);
      if (!isPathInside(RUNS_ROOT, dir)) continue;
      if (!statSync(dir).isDirectory()) continue;

      const statusFile = path.resolve(dir, "status.json");
      if (!isPathInside(dir, statusFile) || !existsSync(statusFile)) continue;

      try {
        const raw = JSON.parse(readFileSync(statusFile, "utf-8"));
        runs.push({
          runId: raw.runId ?? name,
          state: raw.state ?? "done",
          step: raw.step,
          progress: raw.progress,
          startedAt: raw.startedAt,
          finishedAt: raw.finishedAt,
          updatedAt: raw.updatedAt,
          metadata: raw.metadata,
          hasReport: Boolean(raw.reportUrl),
          hasParams: Boolean(raw.paramsUrl),
          hasPdf: Boolean(raw.pdfUrl),
          chartsCount: Array.isArray(raw.charts) ? raw.charts.length : 0,
        });
      } catch {
        // 损坏的 status.json 跳过
      }
    }
  }

  runs.sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json({ runs }, { headers: { "Cache-Control": "no-store" } });
}
