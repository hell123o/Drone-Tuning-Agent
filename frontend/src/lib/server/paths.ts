import * as path from "node:path";

export const PROJECT_ROOT =
  process.env.DRONE_AGENT_PROJECT_ROOT || path.join(/*turbopackIgnore: true*/ process.cwd(), "..");

export const BACKEND_ROOT =
  process.env.DRONE_AGENT_BACKEND_ROOT || path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "backend");

export const RUNS_ROOT =
  process.env.DRONE_AGENT_RUNS_ROOT || path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "runs");

export const LATEST_FILE = path.join(RUNS_ROOT, "latest.json");

export function isPathInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}
