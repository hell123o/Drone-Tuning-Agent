import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFailureStatus,
  formatCommandForDisplay,
} from "../src/lib/diagnose-status.mjs";

test("formatCommandForDisplay quotes arguments that contain spaces", () => {
  assert.equal(
    formatCommandForDisplay("C:\\Program Files\\Drone\\drone-agent-cli.exe", [
      "C:\\Users\\Test User\\flight log.ulg",
      "--output",
      "C:\\Runs\\run-1",
    ]),
    '"C:\\Program Files\\Drone\\drone-agent-cli.exe" "C:\\Users\\Test User\\flight log.ulg" --output C:\\Runs\\run-1',
  );
});

test("buildFailureStatus includes process diagnostics for failed child processes", () => {
  const status = buildFailureStatus({
    runId: "run-1",
    step: "diagnosis failed",
    startedAt: "2026-06-27T00:00:00.000Z",
    command: "C:\\Runtime\\drone-agent-cli.exe",
    args: ["C:\\Logs\\bad.bin", "--output", "C:\\Runs\\run-1"],
    cwd: "C:\\Runtime",
    outputDir: "C:\\Runs\\run-1",
    projectRoot: "C:\\Runtime",
    code: 1,
    signal: null,
    stdout: "parsed header\n",
    stderr: "Traceback\nValueError: cannot mmap an empty file\n",
  });

  assert.equal(status.runId, "run-1");
  assert.equal(status.state, "error");
  assert.equal(status.progress, 100);
  assert.equal(status.code, 1);
  assert.equal(status.diagnostics.command, "C:\\Runtime\\drone-agent-cli.exe C:\\Logs\\bad.bin --output C:\\Runs\\run-1");
  assert.equal(status.diagnostics.cwd, "C:\\Runtime");
  assert.equal(status.diagnostics.outputDir, "C:\\Runs\\run-1");
  assert.equal(status.stderrTail, "Traceback\nValueError: cannot mmap an empty file\n");
  assert.match(status.error, /Exit code: 1/);
  assert.match(status.error, /Command: C:\\Runtime\\drone-agent-cli\.exe C:\\Logs\\bad\.bin --output C:\\Runs\\run-1/);
  assert.match(status.error, /Working directory: C:\\Runtime/);
  assert.match(status.error, /ValueError: cannot mmap an empty file/);
});
