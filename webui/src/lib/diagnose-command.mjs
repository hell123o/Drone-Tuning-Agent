import path from "node:path";

export function pickDiagnosisRunner({
  projectRoot,
  env = process.env,
  platform = process.platform,
  existsSync,
}) {
  const runtimeCli = path.join(projectRoot, "drone-agent-cli.exe");
  if (existsSync(runtimeCli)) {
    return { command: runtimeCli, argsPrefix: [], source: "runtime-cli" };
  }

  const bundledCli = String(env.DRONE_AGENT_BUNDLED_CLI_EXE || "");
  if (bundledCli && existsSync(bundledCli)) {
    return { command: bundledCli, argsPrefix: [], source: "bundled-cli" };
  }

  const windowsPython = path.join(projectRoot, ".venv-win", "Scripts", "python.exe");
  if (existsSync(windowsPython)) {
    return { command: windowsPython, argsPrefix: ["main.py"], source: "windows-venv-python" };
  }

  const wslPython = path.join(projectRoot, ".venv", "bin", "python");
  if (platform !== "win32" && existsSync(wslPython)) {
    return { command: wslPython, argsPrefix: ["main.py"], source: "wsl-venv-python" };
  }

  return { command: "python", argsPrefix: ["main.py"], source: "system-python" };
}
