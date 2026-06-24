import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

const PROJECT_ROOT = process.env.DRONE_AGENT_PROJECT_ROOT || path.resolve(process.cwd(), "..");
const RUNS_ROOT = path.join(PROJECT_ROOT, "webui_runs");
const LATEST_FILE = path.join(RUNS_ROOT, "latest.json");

export const dynamic = "force-dynamic";

type LatestRun = {
  runId: string;
  reportUrl: string;
  pdfUrl?: string;
  paramsUrl: string;
  charts?: { name: string; url: string }[];
  finishedAt?: string;
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
  return labels.map(([key, label]) => [label, metadata?.[key]] as const).filter(([, value]) => value && value.trim());
}

export default function LatestPage() {
  const latest: LatestRun | null = existsSync(LATEST_FILE)
    ? JSON.parse(readFileSync(LATEST_FILE, "utf-8"))
    : null;

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border bg-card p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">最近一次诊断结果</h1>
          <Link href="/" className="text-sm text-primary underline">
            返回诊断页面
          </Link>
        </div>
        {!latest ? (
          <p className="text-muted-foreground">还没有诊断结果。</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Run ID: {latest.runId}</p>
            <p className="text-sm text-muted-foreground">完成时间: {latest.finishedAt ?? "未知"}</p>
            {metadataRows(latest.metadata).length ? (
              <div className="rounded-xl border p-4">
                <h2 className="mb-3 text-lg font-semibold">测试信息</h2>
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  {metadataRows(latest.metadata).map(([label, value]) => (
                    <div key={label} className="flex gap-2">
                      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <a className="rounded-lg border px-4 py-2" href={latest.reportUrl} target="_blank">
                打开 Markdown 报告
              </a>
              <a className="rounded-lg border px-4 py-2" href={latest.pdfUrl ?? latest.reportUrl.replace(/diagnosis\.md$/, "diagnosis.pdf")} target="_blank">
                下载 PDF 报告
              </a>
              <a className="rounded-lg border px-4 py-2" href={latest.paramsUrl} target="_blank">
                下载完整参数文件
              </a>
            </div>
            {latest.charts?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {latest.charts.map((chart) => (
                  <div key={chart.name} className="rounded-xl border p-3">
                    <p className="mb-2 text-sm">{chart.name}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chart.url} alt={chart.name} className="w-full rounded bg-white" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
