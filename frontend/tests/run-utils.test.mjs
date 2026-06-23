import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDuration,
  formatRunTime,
  shortRunId,
  statusColor,
} from "../src/features/runs/run-utils.mjs";

test("shortRunId returns first 8 chars of runId", () => {
  assert.equal(shortRunId("20260623110400_log_92.ulg"), "20260623");
});

test("shortRunId handles short runId", () => {
  assert.equal(shortRunId("abc"), "abc");
});

test("statusColor returns dot color class for each state", () => {
  assert.equal(statusColor("done"), "bg-emerald-500");
  assert.equal(statusColor("error"), "bg-rose-500");
  assert.equal(statusColor("running"), "bg-blue-500");
  assert.equal(statusColor("uploading"), "bg-blue-400");
  assert.equal(statusColor("unknown"), "bg-muted-foreground");
});

test("formatRunTime renders ISO to zh-CN locale string", () => {
  const result = formatRunTime("2026-06-23T11:04:55.174Z");
  assert.match(result, /2026/);
});

test("formatRunTime returns empty string for falsy input", () => {
  assert.equal(formatRunTime(""), "");
  assert.equal(formatRunTime(undefined), "");
});

test("formatDuration computes seconds from startedAt to finishedAt", () => {
  const result = formatDuration("2026-06-23T11:04:00.000Z", "2026-06-23T11:04:55.000Z");
  assert.equal(result, "55 秒");
});

test("formatDuration returns empty string if either timestamp missing", () => {
  assert.equal(formatDuration("", "2026-06-23T11:04:55.000Z"), "");
  assert.equal(formatDuration("2026-06-23T11:04:00.000Z", ""), "");
});
