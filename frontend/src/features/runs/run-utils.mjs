export function shortRunId(runId) {
  if (!runId) return "";
  return runId.slice(0, 8);
}

export function statusColor(state) {
  if (state === "done") return "bg-emerald-500";
  if (state === "error") return "bg-rose-500";
  if (state === "running") return "bg-blue-500";
  if (state === "uploading") return "bg-blue-400";
  return "bg-muted-foreground";
}

export function formatRunTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "";
  }
}

export function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return "";
  try {
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    if (ms < 0) return "";
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec} 秒`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min} 分 ${rem} 秒`;
  } catch {
    return "";
  }
}
