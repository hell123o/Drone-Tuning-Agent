import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRunError,
  clampProgress,
  fileSummary,
  initialTestTime,
} from "../src/features/wizard/wizard-utils.mjs";

test("clampProgress bounds progress values for progress bar width", () => {
  assert.equal(clampProgress(-5), 0);
  assert.equal(clampProgress(42.4), 42.4);
  assert.equal(clampProgress(150), 100);
});

test("fileSummary renders selected file name and size in MB", () => {
  assert.equal(fileSummary({ name: "flight.ulg", size: 2 * 1024 * 1024 }), "已选择：flight.ulg (2.00 MB)");
});

test("fileSummary returns empty string for null file", () => {
  assert.equal(fileSummary(null), "");
});

test("buildRunError joins primary error and output tails without blank noise", () => {
  assert.equal(
    buildRunError({ error: "failed", stderrTail: "stderr", stdoutTail: "stdout" }),
    "failed\nstderr\nstdout",
  );
});

test("initialTestTime produces a non-empty localized timestamp", () => {
  assert.match(initialTestTime(), /\d/);
});
