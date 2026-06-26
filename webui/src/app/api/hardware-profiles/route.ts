import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { deleteUserHardwareProfile, readHardwareProfileCatalog, saveUserHardwareProfile } from "@/lib/hardware-profile-registry.mjs";

const PROJECT_ROOT = process.env.DRONE_AGENT_PROJECT_ROOT || path.resolve(process.cwd(), "..");
const CONFIG_ROOT = path.join(PROJECT_ROOT, "config");
const BUNDLED_CONFIG_ROOT = process.env.DRONE_AGENT_BUNDLED_CONFIG_ROOT;
const WINDOWS_CLI_EXE = path.join(PROJECT_ROOT, "drone-agent-cli.exe");
const WINDOWS_PYTHON = path.join(PROJECT_ROOT, ".venv-win", "Scripts", "python.exe");
const WSL_PYTHON = path.join(PROJECT_ROOT, ".venv", "bin", "python");

function pickPython() {
  if (existsSync(WINDOWS_CLI_EXE)) return WINDOWS_CLI_EXE;
  if (existsSync(WINDOWS_PYTHON)) return WINDOWS_PYTHON;
  if (process.platform !== "win32" && existsSync(WSL_PYTHON)) return WSL_PYTHON;
  return "python";
}

/**
 * Load the merged (flat) profile via the Python CLI so the layer-merge logic
 * lives in one place. Falls back to reading the raw profile file if the CLI is
 * unavailable (e.g. no interpreter) — the raw file is reference-style and will
 * be missing vehicle/param fields, but the request still succeeds.
 */
function loadMergedProfile(id: string, fallbackFile: string): Record<string, unknown> {
  const cmd = pickPython();
  const args = cmd === WINDOWS_CLI_EXE ? ["--view-profile", id] : ["main.py", "--view-profile", id];
  try {
    const out = execFileSync(cmd, args, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      env: {
        ...process.env,
        DRONE_AGENT_PROJECT_ROOT: PROJECT_ROOT,
        ...(BUNDLED_CONFIG_ROOT ? { DRONE_AGENT_BUNDLED_CONFIG_ROOT: BUNDLED_CONFIG_ROOT } : {}),
      },
      windowsHide: true,
    });
    return JSON.parse(out);
  } catch {
    return readJson(fallbackFile);
  }
}

type ManifestProfile = {
  id: string;
  label: string;
  report_label?: string;
  path: string;
  user?: boolean;
  configRoot?: string;
};

type Manifest = {
  default?: string;
  profiles: ManifestProfile[];
};

function readJson(file: string) {
  return JSON.parse(readFileSync(file, "utf-8"));
}

function resolveProfilePath(entry: ManifestProfile) {
  const root = entry.configRoot || CONFIG_ROOT;
  const profileRoot = path.join(root, "hardware-profiles");
  const resolved = path.resolve(profileRoot, entry.path);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error(`Profile path escapes config directory: ${entry.path}`);
  }
  return resolved;
}

function profileSummary(entry: ManifestProfile, defaultId?: string) {
  const filePath = resolveProfilePath(entry);
  return {
    id: entry.id,
    label: entry.label,
    reportLabel: entry.report_label ?? entry.label,
    path: path.relative(PROJECT_ROOT, filePath),
    default: entry.id === defaultId,
    user: entry.user === true,
    exists: existsSync(filePath),
  };
}

export async function GET(request: NextRequest) {
  let manifest: Manifest;
  try {
    manifest = readHardwareProfileCatalog({ projectRoot: PROJECT_ROOT, bundledConfigRoot: BUNDLED_CONFIG_ROOT }) as Manifest;
  } catch {
    return NextResponse.json({ error: "Hardware profile manifest not found" }, { status: 404 });
  }

  const profiles = manifest.profiles.map((entry) => profileSummary(entry, manifest.default));
  const requestedId = request.nextUrl.searchParams.get("id") || manifest.default || profiles[0]?.id;
  const selectedEntry = manifest.profiles.find((entry) => entry.id === requestedId);

  if (!selectedEntry) {
    return NextResponse.json(
      { error: `Unknown hardware profile: ${requestedId}`, profiles },
      { status: 404 },
    );
  }

  const selectedPath = resolveProfilePath(selectedEntry);
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
        data: loadMergedProfile(selectedEntry.id, selectedPath),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string;
      label?: string;
      profileJson?: string;
    };
    const profile = saveUserHardwareProfile({
      projectRoot: PROJECT_ROOT,
      bundledConfigRoot: BUNDLED_CONFIG_ROOT,
      id: body.id,
      label: body.label,
      profileJson: body.profileJson,
    });
    return NextResponse.json(
      { profile },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const result = deleteUserHardwareProfile({ projectRoot: PROJECT_ROOT, bundledConfigRoot: BUNDLED_CONFIG_ROOT, id });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
