import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { isPathInside, RUNS_ROOT } from "@/lib/server/paths";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const runRoot = path.resolve(RUNS_ROOT, runId);
  const statusFile = path.resolve(runRoot, "status.json");
  if (!isPathInside(RUNS_ROOT, runRoot) || !isPathInside(runRoot, statusFile) || !existsSync(statusFile)) {
    return NextResponse.json({ error: "任务不存在或尚未开始", runId }, { status: 404 });
  }
  const status = JSON.parse(readFileSync(statusFile, "utf-8"));
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
