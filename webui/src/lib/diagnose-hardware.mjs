import { writeFileSync } from "node:fs";
import path from "node:path";

export const CUSTOM_HARDWARE_FILENAME = "custom_hardware_profile.json";

export function parseCustomHardwareJson(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`自定义硬件画像 JSON 格式错误：${message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("自定义硬件画像 JSON 必须是一个对象");
  }

  return parsed;
}

export function prepareHardwareSelection({
  outputDir,
  hardwareFile = "",
  hardwareProfile = "",
  customHardwareJson = "",
}) {
  const customHardware = parseCustomHardwareJson(customHardwareJson);
  if (customHardware) {
    const targetPath = path.join(outputDir, CUSTOM_HARDWARE_FILENAME);
    writeFileSync(targetPath, JSON.stringify(customHardware, null, 2), "utf-8");
    return {
      hardwareFile: targetPath,
      hardwareProfile: "",
    };
  }

  return {
    hardwareFile: String(hardwareFile || "").trim(),
    hardwareProfile: String(hardwareProfile || "").trim(),
  };
}

export function appendHardwareArgs(args, selection) {
  if (selection.hardwareFile) {
    args.push("--hardware", selection.hardwareFile);
    return;
  }
  if (selection.hardwareProfile) {
    args.push("--profile", selection.hardwareProfile);
  }
}
