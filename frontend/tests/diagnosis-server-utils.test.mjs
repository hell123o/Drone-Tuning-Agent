import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildPythonArgs,
  isBundledCli,
  normalizeLocalPath,
  safeFileName,
  safeRunId,
} from "../src/lib/server/diagnosis-utils.mjs";

test("safeRunId sanitizes unsafe file names and uses a stable timestamp", () => {
  assert.equal(safeRunId("D:/logs/a bad log.ulg", new Date("2026-06-22T15:32:14Z")), "20260622153214_a_bad_log.ulg");
});

test("safeFileName preserves Chinese characters and removes path separators", () => {
  assert.equal(safeFileName("../测试 log.ulg"), "测试_log.ulg");
});

test("normalizeLocalPath converts Windows paths on non-Windows hosts only", () => {
  assert.equal(normalizeLocalPath("D:\\logs\\flight.ulg", "linux"), "/mnt/d/logs/flight.ulg");
  assert.equal(normalizeLocalPath("D:\\logs\\flight.ulg", "win32"), "D:\\logs\\flight.ulg");
});

test("isBundledCli identifies packaged Windows CLI commands", () => {
  assert.equal(isBundledCli(path.join("runtime", "drone-agent-cli.exe")), true);
  assert.equal(isBundledCli("python"), false);
});

test("buildPythonArgs keeps bundled CLI args and script args distinct", () => {
  const common = {
    logfile: "log.ulg",
    outputDir: "out",
    paramsFile: "2.params",
    question: "check hover",
    hardwareFile: "x760.json",
    apiBase: "http://localhost:8310/v1",
    model: "local-model",
    metadataFile: "metadata.json",
  };
  assert.deepEqual(buildPythonArgs({ ...common, command: "drone-agent-cli.exe" }), [
    "log.ulg",
    "--output",
    "out",
    "-p",
    "2.params",
    "-q",
    "check hover",
    "--hardware",
    "x760.json",
    "--api-base",
    "http://localhost:8310/v1",
    "--model",
    "local-model",
    "--metadata",
    "metadata.json",
  ]);
  assert.deepEqual(buildPythonArgs({ ...common, command: "python" }).slice(0, 3), ["main.py", "log.ulg", "--output"]);
});
