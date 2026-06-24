import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

const PROJECT_ROOT = process.env.DRONE_AGENT_PROJECT_ROOT || path.resolve(process.cwd(), "..");
const RUNS_ROOT = path.join(PROJECT_ROOT, "webui_runs");

export const dynamic = "force-dynamic";

type Status = {
  runId: string;
  state?: "uploading" | "running" | "done" | "error";
  step?: string;
  progress?: number;
  reportUrl?: string;
  pdfUrl?: string;
  paramsUrl?: string;
  charts?: { name: string; url: string }[];
  error?: string;
  stdoutTail?: string;
  stderrTail?: string;
  updatedAt?: string;
  metadata?: Record<string, string>;
};

function metadataRows(metadata?: Record<string, string>) {
  const labels: [string, string][] = [
    ["testTime", "测试时间"],
    ["testLocation", "测试地点"],
    ["testProject", "测试项目"],
    ["testOperator", "测试人员"],
    ["testAircraft", "测试机型"],
  ];
  return labels
    .map(([key, label]) => [label, metadata?.[key]] as const)
    .filter(([, value]) => value && value.trim());
}

export default async function ProgressPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const runRoot = path.resolve(RUNS_ROOT, runId);
  const statusFile = path.resolve(runRoot, "status.json");
  const status: Status = existsSync(statusFile)
    ? JSON.parse(readFileSync(statusFile, "utf-8"))
    : { runId, state: "running", step: "任务已提交，等待服务器创建状态文件...", progress: 1 };
  const metadataFile = path.resolve(runRoot, "test_metadata.json");
  const metadata = status.metadata || (existsSync(metadataFile) ? JSON.parse(readFileSync(metadataFile, "utf-8")) : undefined);
  const metaRows = metadataRows(metadata);

  const progress = Math.max(0, Math.min(100, status.progress ?? 0));
  const done = status.state === "done";
  const failed = status.state === "error";

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      {!done && !failed ? <meta httpEquiv="refresh" content="2" /> : null}
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">诊断进度</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">Run ID: {runId}</p>
          </div>
          <Link href="/" className="rounded-lg border px-4 py-2 text-sm">
            返回诊断页面
          </Link>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="flex justify-between text-sm">
            <span>{status.step ?? "诊断运行中..."}</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">状态：{status.state ?? "running"}，更新时间：{status.updatedAt ?? "未知"}</p>
        </div>

        {metaRows.length ? (
          <div className="rounded-xl border p-4">
            <h2 className="mb-3 text-lg font-semibold">测试信息</h2>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {metaRows.map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {failed ? (
          <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <h2 className="text-xl font-semibold">诊断失败</h2>
            <pre className="whitespace-pre-wrap text-xs">{status.error || status.stderrTail || status.stdoutTail || "未知错误"}</pre>
          </div>
        ) : null}

        {done ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <a className="rounded-lg border px-4 py-2" href={status.reportUrl} target="_blank">
                打开 Markdown 报告
              </a>
              <a className="rounded-lg border px-4 py-2" href={status.pdfUrl} target="_blank">
                下载 PDF 报告
              </a>
              <a className="rounded-lg border px-4 py-2" href={status.paramsUrl} target="_blank">
                下载参数文件
              </a>
            </div>
            {status.charts?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {status.charts.map((chart) => (
                  <div key={chart.name} className="rounded-xl border p-3">
                    <p className="mb-2 text-sm">{chart.name}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chart.url} alt={chart.name} className="w-full rounded bg-white" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">页面会每 2 秒自动刷新。日志较大时请等待，不要重复点击提交。</p>
        )}
      </div>
    </main>
  );
}
