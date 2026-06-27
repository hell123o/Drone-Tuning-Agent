import assert from "node:assert/strict";
import test from "node:test";

import { pickDiagnosisRunner } from "../src/lib/diagnose-command.mjs";

function fakeExists(paths) {
  const available = new Set(paths);
  return (target) => available.has(target);
}

test("pickDiagnosisRunner prefers the runtime CLI copied into the user data directory", () => {
  const runner = pickDiagnosisRunner({
    projectRoot: "C:\\Runtime",
    env: { DRONE_AGENT_BUNDLED_CLI_EXE: "C:\\Portable\\resources\\app-core\\drone-agent-cli.exe" },
    platform: "win32",
    existsSync: fakeExists([
      "C:\\Runtime\\drone-agent-cli.exe",
      "C:\\Portable\\resources\\app-core\\drone-agent-cli.exe",
    ]),
  });

  assert.deepEqual(runner, {
    command: "C:\\Runtime\\drone-agent-cli.exe",
    argsPrefix: [],
    source: "runtime-cli",
  });
});

test("pickDiagnosisRunner falls back to the bundled CLI when runtime copy is missing", () => {
  const runner = pickDiagnosisRunner({
    projectRoot: "C:\\Runtime",
    env: { DRONE_AGENT_BUNDLED_CLI_EXE: "C:\\Portable\\resources\\app-core\\drone-agent-cli.exe" },
    platform: "win32",
    existsSync: fakeExists(["C:\\Portable\\resources\\app-core\\drone-agent-cli.exe"]),
  });

  assert.deepEqual(runner, {
    command: "C:\\Portable\\resources\\app-core\\drone-agent-cli.exe",
    argsPrefix: [],
    source: "bundled-cli",
  });
});

test("pickDiagnosisRunner uses the Windows venv Python before system Python in development", () => {
  const runner = pickDiagnosisRunner({
    projectRoot: "D:\\Workspace\\drone-agent",
    env: {},
    platform: "win32",
    existsSync: fakeExists(["D:\\Workspace\\drone-agent\\.venv-win\\Scripts\\python.exe"]),
  });

  assert.deepEqual(runner, {
    command: "D:\\Workspace\\drone-agent\\.venv-win\\Scripts\\python.exe",
    argsPrefix: ["main.py"],
    source: "windows-venv-python",
  });
});
