import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ensureHardwareProfileConfig,
  deleteUserHardwareProfile,
  saveUserHardwareProfile,
} from "../src/lib/hardware-profile-registry.mjs";

function withConfig(fn) {
  const root = mkdtempSync(path.join(tmpdir(), "drone-profile-registry-"));
  const profileRoot = path.join(root, "config", "hardware-profiles");
  mkdirSync(profileRoot, { recursive: true });
  writeFileSync(
    path.join(profileRoot, "manifest.json"),
    JSON.stringify(
      {
        default: "x760_base",
        profiles: [
          {
            id: "x760_base",
            label: "X760 base",
            report_label: "base",
            path: "x760_base.json",
          },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
  writeFileSync(path.join(profileRoot, "x760_base.json"), '{"name":"X760"}', "utf-8");
  mkdirSync(path.join(root, "config", "vehicles"), { recursive: true });
  writeFileSync(path.join(root, "config", "vehicles", "x760.json"), '{"name":"X760 vehicle"}', "utf-8");

  try {
    return fn({ root, profileRoot });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf-8"));
}

test("saveUserHardwareProfile writes a user profile file and appends manifest entry", () => {
  withConfig(({ root, profileRoot }) => {
    const result = saveUserHardwareProfile({
      projectRoot: root,
      id: "x760_payload",
      label: "X760 Payload",
      profileJson: '{"name":"X760 payload","propeller_inch":18}',
    });

    assert.equal(result.id, "x760_payload");
    assert.equal(result.label, "X760 Payload");
    assert.equal(result.user, true);
    assert.equal(result.path, "user_x760_payload.json");

    const manifest = readJson(path.join(profileRoot, "manifest.json"));
    assert.deepEqual(manifest.profiles.at(-1), {
      id: "x760_payload",
      label: "X760 Payload",
      report_label: "X760 Payload",
      path: "user_x760_payload.json",
      user: true,
    });
    assert.deepEqual(readJson(path.join(profileRoot, "user_x760_payload.json")), {
      name: "X760 payload",
      propeller_inch: 18,
    });
  });
});

test("saveUserHardwareProfile replaces an existing user profile with the same id", () => {
  withConfig(({ root, profileRoot }) => {
    saveUserHardwareProfile({
      projectRoot: root,
      id: "x760_payload",
      label: "X760 Payload",
      profileJson: '{"name":"first"}',
    });
    saveUserHardwareProfile({
      projectRoot: root,
      id: "x760_payload",
      label: "X760 Payload v2",
      profileJson: '{"name":"second"}',
    });

    const manifest = readJson(path.join(profileRoot, "manifest.json"));
    const entries = manifest.profiles.filter((entry) => entry.id === "x760_payload");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].label, "X760 Payload v2");
    assert.deepEqual(readJson(path.join(profileRoot, "user_x760_payload.json")), {
      name: "second",
    });
  });
});

test("deleteUserHardwareProfile removes only user-created profiles", () => {
  withConfig(({ root, profileRoot }) => {
    saveUserHardwareProfile({
      projectRoot: root,
      id: "x760_payload",
      label: "X760 Payload",
      profileJson: '{"name":"payload"}',
    });

    const result = deleteUserHardwareProfile({ projectRoot: root, id: "x760_payload" });
    assert.equal(result.deleted, true);
    assert.equal(existsSync(path.join(profileRoot, "user_x760_payload.json")), false);

    const manifest = readJson(path.join(profileRoot, "manifest.json"));
    assert.equal(manifest.profiles.some((entry) => entry.id === "x760_payload"), false);
    assert.equal(manifest.profiles.some((entry) => entry.id === "x760_base"), true);
  });
});

test("deleteUserHardwareProfile rejects built-in profiles", () => {
  withConfig(({ root, profileRoot }) => {
    assert.throws(
      () => deleteUserHardwareProfile({ projectRoot: root, id: "x760_base" }),
      /built-in/,
    );
    assert.equal(existsSync(path.join(profileRoot, "x760_base.json")), true);
  });
});

test("saveUserHardwareProfile rejects ids that could escape the profile directory", () => {
  withConfig(({ root }) => {
    assert.throws(
      () =>
        saveUserHardwareProfile({
          projectRoot: root,
          id: "../bad",
          label: "Bad",
          profileJson: '{"name":"bad"}',
        }),
      /id/,
    );
  });
});

test("ensureHardwareProfileConfig seeds missing runtime profiles from bundled config", () => {
  withConfig(({ root: bundledRoot, profileRoot: bundledProfileRoot }) => {
    const runtimeRoot = mkdtempSync(path.join(tmpdir(), "drone-profile-runtime-"));
    try {
      const ensured = ensureHardwareProfileConfig({
        projectRoot: runtimeRoot,
        bundledConfigRoot: path.join(bundledRoot, "config"),
      });

      assert.equal(ensured, true);
      assert.equal(
        existsSync(path.join(runtimeRoot, "config", "hardware-profiles", "manifest.json")),
        true,
      );
      assert.deepEqual(
        readJson(path.join(runtimeRoot, "config", "hardware-profiles", "manifest.json")),
        readJson(path.join(bundledProfileRoot, "manifest.json")),
      );
      assert.equal(
        existsSync(path.join(runtimeRoot, "config", "hardware-profiles", "x760_base.json")),
        true,
      );
      assert.equal(
        existsSync(path.join(runtimeRoot, "config", "vehicles", "x760.json")),
        true,
      );
    } finally {
      rmSync(runtimeRoot, { recursive: true, force: true });
    }
  });
});

test("ensureHardwareProfileConfig preserves user profiles while refreshing bundled profiles", () => {
  withConfig(({ root: bundledRoot }) => {
    const runtimeRoot = mkdtempSync(path.join(tmpdir(), "drone-profile-runtime-"));
    const runtimeProfileRoot = path.join(runtimeRoot, "config", "hardware-profiles");
    mkdirSync(runtimeProfileRoot, { recursive: true });
    writeFileSync(
      path.join(runtimeProfileRoot, "manifest.json"),
      JSON.stringify(
        {
          default: "old_default",
          profiles: [
            {
              id: "old_default",
              label: "Old default",
              path: "old_default.json",
            },
            {
              id: "x760_payload",
              label: "X760 Payload",
              report_label: "X760 Payload",
              path: "user_x760_payload.json",
              user: true,
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );
    writeFileSync(path.join(runtimeProfileRoot, "user_x760_payload.json"), '{"name":"payload"}', "utf-8");

    try {
      ensureHardwareProfileConfig({
        projectRoot: runtimeRoot,
        bundledConfigRoot: path.join(bundledRoot, "config"),
      });

      const manifest = readJson(path.join(runtimeProfileRoot, "manifest.json"));
      assert.equal(manifest.default, "x760_base");
      assert.equal(manifest.profiles.some((entry) => entry.id === "x760_base"), true);
      assert.equal(manifest.profiles.some((entry) => entry.id === "old_default"), false);
      assert.deepEqual(manifest.profiles.at(-1), {
        id: "x760_payload",
        label: "X760 Payload",
        report_label: "X760 Payload",
        path: "user_x760_payload.json",
        user: true,
      });
      assert.deepEqual(readJson(path.join(runtimeProfileRoot, "user_x760_payload.json")), {
        name: "payload",
      });
    } finally {
      rmSync(runtimeRoot, { recursive: true, force: true });
    }
  });
});
