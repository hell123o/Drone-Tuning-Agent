import path from "node:path";

export function safeRunId(logfile, now = new Date()) {
  const base = path.basename(logfile || "flight-log").replace(/[^a-zA-Z0-9_.-]+/g, "_");
  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${stamp}_${base}`;
}

export function safeFileName(name) {
  return path.basename(name || "input").replace(/[^a-zA-Z0-9_.\-\u4e00-\u9fa5]+/g, "_");
}

export function normalizeLocalPath(input, platform = process.platform) {
  const value = input?.trim();
  if (!value) return "";
  if (platform === "win32") return value;
  const match = value.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (!match) return value;
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, "/");
  return `/mnt/${drive}/${rest}`;
}

export function isBundledCli(command) {
  return path.basename(command).toLowerCase() === "drone-agent-cli.exe";
}

export function buildPythonArgs({
  command,
  logfile,
  outputDir,
  paramsFile,
  question,
  hardwareFile,
  apiBase,
  model,
  metadataFile,
}) {
  const args = isBundledCli(command)
    ? [logfile, "--output", outputDir]
    : ["main.py", logfile, "--output", outputDir];
  if (paramsFile) args.push("-p", paramsFile);
  if (question?.trim()) args.push("-q", question.trim());
  if (hardwareFile) args.push("--hardware", hardwareFile);
  if (apiBase?.trim()) args.push("--api-base", apiBase.trim());
  if (model?.trim()) args.push("--model", model.trim());
  if (metadataFile) args.push("--metadata", metadataFile);
  return args;
}
