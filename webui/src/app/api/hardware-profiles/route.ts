import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

const PROJECT_ROOT = process.env.DRONE_AGENT_PROJECT_ROOT || path.resolve(process.cwd(), "..");
const CONFIG_ROOT = path.join(PROJECT_ROOT, "config");
const PROFILE_ROOT = path.join(CONFIG_ROOT, "hardware-profiles");
const MANIFEST_FILE = path.join(PROFILE_ROOT, "manifest.json");

type ManifestProfile = {
  id: string;
  label: string;
  report_label?: string;
  path: string;
};

type Manifest = {
  default?: string;
  profiles: ManifestProfile[];
};

function readJson(file: string) {
  return JSON.parse(readFileSync(file, "utf-8"));
}

function resolveProfilePath(relativePath: string) {
  const resolved = path.resolve(PROFILE_ROOT, relativePath);
  if (!resolved.startsWith(path.resolve(CONFIG_ROOT))) {
    throw new Error(`Profile path escapes config directory: ${relativePath}`);
  }
  return resolved;
}

function profileSummary(entry: ManifestProfile, defaultId?: string) {
  const filePath = resolveProfilePath(entry.path);
  return {
    id: entry.id,
    label: entry.label,
    reportLabel: entry.report_label ?? entry.label,
    path: path.relative(PROJECT_ROOT, filePath),
    default: entry.id === defaultId,
    exists: existsSync(filePath),
  };
}

export async function GET(request: NextRequest) {
  if (!existsSync(MANIFEST_FILE)) {
    return NextResponse.json({ error: "Hardware profile manifest not found" }, { status: 404 });
  }

  const manifest = readJson(MANIFEST_FILE) as Manifest;
  const profiles = manifest.profiles.map((entry) => profileSummary(entry, manifest.default));
  const requestedId = request.nextUrl.searchParams.get("id") || manifest.default || profiles[0]?.id;
  const selectedEntry = manifest.profiles.find((entry) => entry.id === requestedId);

  if (!selectedEntry) {
    return NextResponse.json(
      { error: `Unknown hardware profile: ${requestedId}`, profiles },
      { status: 404 },
    );
  }

  const selectedPath = resolveProfilePath(selectedEntry.path);
  if (!existsSync(selectedPath)) {
    return NextResponse.json(
      { error: `Hardware profile file not found: ${path.relative(PROJECT_ROOT, selectedPath)}`, profiles },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      profiles,
      defaultProfile: manifest.default,
      selectedProfile: {
        ...profileSummary(selectedEntry, manifest.default),
        data: readJson(selectedPath),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
