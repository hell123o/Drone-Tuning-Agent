import assert from "node:assert/strict";
import test from "node:test";

import { normalizeHardwareProfileId } from "../src/lib/profile-id.mjs";

test("normalizeHardwareProfileId keeps valid ascii names", () => {
  assert.equal(normalizeHardwareProfileId("X760 Camera Payload"), "x760_camera_payload");
});

test("normalizeHardwareProfileId uses fallback when a Chinese label has no ascii id", () => {
  assert.equal(normalizeHardwareProfileId("摄影载荷", "custom_profile_abc123"), "custom_profile_abc123");
});

test("normalizeHardwareProfileId normalizes invalid manual ids", () => {
  assert.equal(normalizeHardwareProfileId("我的 X760 画像!", "custom_profile"), "x760");
});
