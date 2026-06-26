import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const USER_PROFILE_PREFIX = "user_";
const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function configRoot(projectRoot) {
  return path.join(projectRoot, "config");
}

function profileRoot(projectRoot) {
  return path.join(configRoot(projectRoot), "hardware-profiles");
}

function manifestPath(projectRoot) {
  return path.join(profileRoot(projectRoot), "manifest.json");
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf-8"));
}

function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function readManifest(projectRoot) {
  const manifest = readJson(manifestPath(projectRoot));
  if (!Array.isArray(manifest.profiles)) {
    throw new Error("Hardware profile manifest is invalid");
  }
  return manifest;
}

function safeReadManifest(projectRoot) {
  try {
    return readManifest(projectRoot);
  } catch {
    return null;
  }
}

function validateProfileId(id) {
  const value = String(id || "").trim();
  if (!PROFILE_ID_PATTERN.test(value)) {
    throw new Error("Hardware profile id must use 2-64 lowercase letters, numbers, underscores, or hyphens");
  }
  return value;
}

function validateLabel(label) {
  const value = String(label || "").trim();
  if (!value) {
    throw new Error("Hardware profile label is required");
  }
  return value;
}

function parseProfileJson(profileJson) {
  let parsed;
  try {
    parsed = JSON.parse(String(profileJson || ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Hardware profile JSON is invalid: ${message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Hardware profile JSON must be an object");
  }
  return parsed;
}

function userProfileFileName(id) {
  return `${USER_PROFILE_PREFIX}${id}.json`;
}

function resolveManifestProfilePath(projectRoot, relativePath) {
  const root = profileRoot(projectRoot);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) {
    throw new Error(`Profile path escapes hardware profile directory: ${relativePath}`);
  }
  return resolved;
}

function copyBundledConfig({ projectRoot, bundledConfigRoot }) {
  mkdirSync(configRoot(projectRoot), { recursive: true });
  cpSync(bundledConfigRoot, configRoot(projectRoot), { recursive: true, force: true });
}

export function ensureHardwareProfileConfig({ projectRoot, bundledConfigRoot }) {
  if (!bundledConfigRoot) return false;

  const bundledManifestFile = path.join(bundledConfigRoot, "hardware-profiles", "manifest.json");
  if (!existsSync(bundledManifestFile)) return false;

  const bundledManifest = readJson(bundledManifestFile);
  if (!Array.isArray(bundledManifest.profiles)) {
    throw new Error("Bundled hardware profile manifest is invalid");
  }

  const runtimeManifest = safeReadManifest(projectRoot);
  const userProfiles = (runtimeManifest?.profiles || []).filter((entry) => entry.user === true);
  copyBundledConfig({ projectRoot, bundledConfigRoot });

  writeJson(manifestPath(projectRoot), {
    ...bundledManifest,
    profiles: [
      ...bundledManifest.profiles,
      ...userProfiles,
    ],
  });
  return true;
}

export function saveUserHardwareProfile({
  projectRoot,
  id,
  label,
  profileJson,
}) {
  const profileId = validateProfileId(id);
  const profileLabel = validateLabel(label);
  const profileData = parseProfileJson(profileJson);
  const manifest = readManifest(projectRoot);
  const existing = manifest.profiles.find((entry) => entry.id === profileId);

  if (existing && !existing.user) {
    throw new Error(`Cannot replace built-in hardware profile: ${profileId}`);
  }

  const relativePath = userProfileFileName(profileId);
  const absolutePath = resolveManifestProfilePath(projectRoot, relativePath);
  writeJson(absolutePath, profileData);

  const nextEntry = {
    id: profileId,
    label: profileLabel,
    report_label: profileLabel,
    path: relativePath,
    user: true,
  };

  manifest.profiles = [
    ...manifest.profiles.filter((entry) => entry.id !== profileId),
    nextEntry,
  ];
  writeJson(manifestPath(projectRoot), manifest);

  return nextEntry;
}

export function deleteUserHardwareProfile({ projectRoot, id }) {
  const profileId = validateProfileId(id);
  const manifest = readManifest(projectRoot);
  const entry = manifest.profiles.find((profile) => profile.id === profileId);
  if (!entry) {
    throw new Error(`Unknown hardware profile: ${profileId}`);
  }
  if (!entry.user) {
    throw new Error(`Cannot delete built-in hardware profile: ${profileId}`);
  }

  const absolutePath = resolveManifestProfilePath(projectRoot, entry.path);
  manifest.profiles = manifest.profiles.filter((profile) => profile.id !== profileId);
  writeJson(manifestPath(projectRoot), manifest);
  if (existsSync(absolutePath)) {
    rmSync(absolutePath, { force: true });
  }

  return { deleted: true, id: profileId };
}
