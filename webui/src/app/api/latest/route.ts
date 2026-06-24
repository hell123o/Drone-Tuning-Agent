import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

const PROJECT_ROOT = process.env.DRONE_AGENT_PROJECT_ROOT || path.resolve(process.cwd(), "..");
const RUNS_ROOT = path.join(PROJECT_ROOT, "webui_runs");
const LATEST_FILE = path.join(RUNS_ROOT, "latest.json");

export async function GET() {
  if (!existsSync(LATEST_FILE)) {
    return NextResponse.json({ latest: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const latest = JSON.parse(readFileSync(LATEST_FILE, "utf-8"));
  return NextResponse.json(latest, { headers: { "Cache-Control": "no-store" } });
}
