export function initialTestTime() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

export function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function fileSummary(file) {
  if (!file) return "";
  return `已选择：${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
}

export function buildRunError(status) {
  return [
    status.error || status.step || "诊断失败",
    status.stderrTail || "",
    status.stdoutTail || "",
  ].filter(Boolean).join("\n").trim();
}
