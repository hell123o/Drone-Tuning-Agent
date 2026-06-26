import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CUSTOM_HARDWARE_FILENAME,
  appendHardwareArgs,
  prepareHardwareSelection,
} from "../src/lib/diagnose-hardware.mjs";

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "drone-hardware-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("custom hardware json is written and overrides the selected profile", () => {
  withTempDir((outputDir) => {
    const selection = prepareHardwareSelection({
      outputDir,
      hardwareProfile: "x760_base",
      customHardwareJson: '{"name":"X760 Custom","propeller_inch":18}',
    });

    const expectedPath = path.join(outputDir, CUSTOM_HARDWARE_FILENAME);
    assert.equal(selection.hardwareFile, expectedPath);
    assert.equal(selection.hardwareProfile, "");
    assert.deepEqual(JSON.parse(readFileSync(expectedPath, "utf-8")), {
      name: "X760 Custom",
      propeller_inch: 18,
    });

    const args = [];
    appendHardwareArgs(args, selection);
    assert.deepEqual(args, ["--hardware", expectedPath]);
  });
});

test("built-in profile is kept when custom hardware json is empty", () => {
  const selection = prepareHardwareSelection({
    outputDir: "unused",
    hardwareProfile: "x760_hflow_s30",
    customHardwareJson: "   ",
  });

  const args = [];
  appendHardwareArgs(args, selection);

  assert.deepEqual(selection, {
    hardwareFile: "",
    hardwareProfile: "x760_hflow_s30",
  });
  assert.deepEqual(args, ["--profile", "x760_hflow_s30"]);
});

test("custom hardware json must be valid json", () => {
  withTempDir((outputDir) => {
    assert.throws(
      () =>
        prepareHardwareSelection({
          outputDir,
          hardwareProfile: "x760_base",
          customHardwareJson: "{bad json",
        }),
      /JSON/,
    );
    assert.equal(existsSync(path.join(outputDir, CUSTOM_HARDWARE_FILENAME)), false);
  });
});

test("custom hardware json must be an object", () => {
  withTempDir((outputDir) => {
    assert.throws(
      () =>
        prepareHardwareSelection({
          outputDir,
          hardwareProfile: "x760_base",
          customHardwareJson: '["not", "an", "object"]',
        }),
      (error) => error instanceof Error && error.message.includes("对象"),
    );
    assert.equal(existsSync(path.join(outputDir, CUSTOM_HARDWARE_FILENAME)), false);
  });
});
