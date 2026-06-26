const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

export function normalizeHardwareProfileId(value, fallback = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  if (PROFILE_ID_PATTERN.test(normalized)) {
    return normalized;
  }

  const fallbackId = String(fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return PROFILE_ID_PATTERN.test(fallbackId) ? fallbackId : "custom_profile";
}
