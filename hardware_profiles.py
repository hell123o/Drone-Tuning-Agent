"""Hardware profile registry utilities."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent
CONFIG_DIR = PROJECT_ROOT / "config"
PROFILE_DIR = CONFIG_DIR / "hardware-profiles"
VEHICLE_DIR = CONFIG_DIR / "vehicles"
PARAM_PROFILE_DIR = CONFIG_DIR / "param-profiles"
MANIFEST_PATH = PROFILE_DIR / "manifest.json"

# Keys that reference other layers; resolved at load time and not emitted in the
# merged output (kept identical to the legacy flat profile shape).
_REFERENCE_KEYS = ("vehicle", "param_profile")


class HardwareProfileError(ValueError):
    """Raised when a hardware profile cannot be resolved or loaded."""


def _read_manifest() -> dict[str, Any]:
    with MANIFEST_PATH.open("r", encoding="utf-8") as f:
        manifest = json.load(f)
    if not isinstance(manifest.get("profiles"), list):
        raise HardwareProfileError(f"Invalid hardware profile manifest: {MANIFEST_PATH}")
    return manifest


def _profile_path(entry: dict[str, Any]) -> Path:
    rel_path = entry.get("path")
    if not rel_path:
        raise HardwareProfileError(f"Hardware profile {entry.get('id', '<unknown>')} has no path")
    return (PROFILE_DIR / rel_path).resolve()


def list_profiles() -> list[dict[str, Any]]:
    """Return profile metadata from the shared manifest."""
    manifest = _read_manifest()
    profiles = []
    for entry in manifest["profiles"]:
        path = _profile_path(entry)
        profiles.append(
            {
                "id": entry["id"],
                "label": entry["label"],
                "path": str(path),
                "relative_path": str(path.relative_to(PROJECT_ROOT)),
                "default": entry["id"] == manifest.get("default"),
                "exists": path.exists(),
            }
        )
    return profiles


def default_profile_id() -> str:
    return str(_read_manifest().get("default") or "x760_base")


def resolve_profile(profile_id: str | None) -> dict[str, Any]:
    """Resolve a profile by id, label, or file stem."""
    wanted = (profile_id or default_profile_id()).strip()
    manifest = _read_manifest()
    for entry in manifest["profiles"]:
        path = _profile_path(entry)
        candidates = {
            str(entry.get("id", "")),
            str(entry.get("label", "")),
            path.stem,
            str(entry.get("path", "")),
        }
        if wanted in candidates:
            return {
                "id": entry["id"],
                "label": entry["label"],
                "report_label": entry.get("report_label") or entry["label"],
                "path": str(path),
                "relative_path": str(path.relative_to(PROJECT_ROOT)),
                "default": entry["id"] == manifest.get("default"),
            }
    available = ", ".join(profile["id"] for profile in list_profiles())
    raise HardwareProfileError(f"Unknown hardware profile '{wanted}'. Available profiles: {available}")


def _load_json(path: Path, kind: str) -> dict[str, Any]:
    if not path.exists():
        raise HardwareProfileError(f"{kind} file does not exist: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise HardwareProfileError(f"{kind} must be a JSON object: {path}")
    return data


def _load_vehicle(vehicle_id: str) -> dict[str, Any]:
    return _load_json(VEHICLE_DIR / f"{vehicle_id}.json", "Vehicle")


def _load_param_profile(param_profile_id: str) -> dict[str, Any]:
    return _load_json(PARAM_PROFILE_DIR / f"{param_profile_id}.json", "Param profile")


def _resolve_layered_profile(data: dict[str, Any]) -> dict[str, Any]:
    """Merge a reference-style hardware profile into a flat dict.

    Layering (later overrides earlier): vehicle base -> param-profile tuning
    -> hardware-profile's own fields. The output key set matches the legacy
    single-file profile shape, so downstream consumers are unchanged. Profiles
    without reference keys are returned as-is (legacy / custom --hardware files).
    """
    if not any(key in data for key in _REFERENCE_KEYS):
        return data

    merged: dict[str, Any] = {}

    vehicle_id = data.get("vehicle")
    if vehicle_id:
        merged.update(_load_vehicle(str(vehicle_id)))

    param_profile_id = data.get("param_profile")
    if param_profile_id:
        param_profile = _load_param_profile(str(param_profile_id))
        for key in ("stable_px4_profile", "safe_adjustment_limits"):
            if key in param_profile:
                merged[key] = param_profile[key]

    for key, value in data.items():
        if key in _REFERENCE_KEYS:
            continue
        merged[key] = value

    return merged


def load_profile(profile_id: str | None = None) -> dict[str, Any]:
    profile = resolve_profile(profile_id)
    path = Path(profile["path"])
    data = _load_json(path, "Hardware profile")
    data = _resolve_layered_profile(data)
    data.setdefault("profile_id", profile["id"])
    data.setdefault("profile_label", profile["label"])
    data.setdefault("profile_display_name", profile["report_label"])
    data.setdefault("profile_file", profile["relative_path"])
    return data
