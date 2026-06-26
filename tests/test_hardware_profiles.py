import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


class HardwareProfilesRuntimeConfigTest(unittest.TestCase):
    def test_uses_runtime_project_root_from_environment(self):
        with tempfile.TemporaryDirectory(prefix="drone-runtime-config-") as root:
            profile_root = Path(root) / "config" / "hardware-profiles"
            profile_root.mkdir(parents=True)
            (profile_root / "manifest.json").write_text(
                json.dumps(
                    {
                        "default": "runtime_profile",
                        "profiles": [
                            {
                                "id": "runtime_profile",
                                "label": "Runtime Profile",
                                "path": "runtime_profile.json",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            (profile_root / "runtime_profile.json").write_text('{"name":"Runtime"}', encoding="utf-8")

            env = {
                **os.environ,
                "DRONE_AGENT_PROJECT_ROOT": root,
                "PYTHONPATH": str(Path(__file__).resolve().parents[1]),
            }
            code = textwrap.dedent(
                """
                import json
                import hardware_profiles
                print(json.dumps(hardware_profiles.list_profiles()))
                """
            )

            result = subprocess.run(
                [sys.executable, "-c", code],
                check=True,
                capture_output=True,
                text=True,
                env=env,
            )

        profiles = json.loads(result.stdout)
        self.assertEqual(profiles[0]["id"], "runtime_profile")
        self.assertIn("Runtime Profile", profiles[0]["label"])

    def test_falls_back_to_bundled_config_when_runtime_manifest_is_missing(self):
        with tempfile.TemporaryDirectory(prefix="drone-runtime-config-") as runtime_root:
            with tempfile.TemporaryDirectory(prefix="drone-bundled-config-") as bundled_root:
                profile_root = Path(bundled_root) / "config" / "hardware-profiles"
                profile_root.mkdir(parents=True)
                (profile_root / "manifest.json").write_text(
                    json.dumps(
                        {
                            "default": "bundled_profile",
                            "profiles": [
                                {
                                    "id": "bundled_profile",
                                    "label": "Bundled Profile",
                                    "path": "bundled_profile.json",
                                }
                            ],
                        }
                    ),
                    encoding="utf-8",
                )
                (profile_root / "bundled_profile.json").write_text('{"name":"Bundled"}', encoding="utf-8")

                env = {
                    **os.environ,
                    "DRONE_AGENT_PROJECT_ROOT": runtime_root,
                    "DRONE_AGENT_BUNDLED_CONFIG_ROOT": str(Path(bundled_root) / "config"),
                    "PYTHONPATH": str(Path(__file__).resolve().parents[1]),
                }
                code = textwrap.dedent(
                    """
                    import json
                    import hardware_profiles
                    print(json.dumps(hardware_profiles.list_profiles()))
                    """
                )

                result = subprocess.run(
                    [sys.executable, "-c", code],
                    check=True,
                    capture_output=True,
                    text=True,
                    env=env,
                )

        profiles = json.loads(result.stdout)
        self.assertEqual(profiles[0]["id"], "bundled_profile")
        self.assertIn("Bundled Profile", profiles[0]["label"])


if __name__ == "__main__":
    unittest.main()
