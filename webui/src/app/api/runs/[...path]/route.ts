import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

const PROJECT_ROOT = process.env.DRONE_AGENT_PROJECT_ROOT || path.resolve(process.cwd(), "..");
const RUNS_ROOT = path.join(PROJECT_ROOT, "webui_runs");

const CONTENT_TYPES: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".params": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: pathParts } = await context.params;
  if (!pathParts || pathParts.length < 2) {
    return NextResponse.json({ error: "Invalid run file path" }, { status: 400 });
  }

  const [runId, ...fileParts] = pathParts;
  const filePath = path.resolve(RUNS_ROOT, runId, ...fileParts);
  const runRoot = path.resolve(RUNS_ROOT, runId);

  if (!filePath.startsWith(runRoot) || !existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(filePath);
  const body = readFileSync(filePath);
  const fileName = path.basename(filePath);
  const shouldDownload = ext === ".params" || ext === ".pdf";
  return new NextResponse(body, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      ...(shouldDownload ? { "Content-Disposition": `attachment; filename="${fileName}"` } : {}),
      "Cache-Control": "no-store",
    },
  });
}
