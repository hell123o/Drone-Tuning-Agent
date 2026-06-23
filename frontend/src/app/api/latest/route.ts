import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";

import { LATEST_FILE } from "@/lib/server/paths";

export async function GET() {
  if (!existsSync(LATEST_FILE)) {
    return NextResponse.json({ latest: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const latest = JSON.parse(readFileSync(LATEST_FILE, "utf-8"));
  return NextResponse.json(latest, { headers: { "Cache-Control": "no-store" } });
}
