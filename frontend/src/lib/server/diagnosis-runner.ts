import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import { BACKEND_ROOT, LATEST_FILE, PROJECT_ROOT } from "@/lib/server/paths";

const CLI_CANDIDATES = [
  path.join(BACKEND_ROOT, "drone-agent-cli.exe"),
  path.join(PROJECT_ROOT, "drone-agent-cli.exe"),
];
const PYTHON_CANDIDATES = [
  path.join(BACKEND_ROOT, ".venv-win", "Scripts", "python.exe"),
  path.join(PROJECT_ROOT, ".venv-win", "Scripts", "python.exe"),
  path.join(BACKEND_ROOT, ".venv", "bin", "python"),
  path.join(PROJECT_ROOT, ".venv", "bin", "python"),
];

type StartDiagnosisJobInput = {
  runId: string;
  outputDir: string;
  command: string;
  args: string[];
  apiKey?: string;
};

export function pickPython() {
  for (const candidate of CLI_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  for (const candidate of PYTHON_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return "python";
}

function backendCwd() {
  return existsSync(BACKEND_ROOT) ? BACKEND_ROOT : PROJECT_ROOT;
}

function statusPath(outputDir: string) {
  return path.join(outputDir, "status.json");
}

export function writeStatus(outputDir: string, status: Record<string, unknown>) {
  writeFileSync(
    statusPath(outputDir),
    JSON.stringify({ updatedAt: new Date().toISOString(), ...status }, null, 2),
    "utf-8",
  );
}

function buildDoneResponse(runId: string, outputDir: string, stdout: string, stderr: string) {
  const files = existsSync(outputDir) ? readdirSync(outputDir) : [];
  const charts = files.filter((file) => file.endsWith(".png"));
  const chartDataUrl = files.includes("charts.json") ? `/api/runs/${runId}/charts.json` : undefined;
  const metadataPath = path.join(outputDir, "test_metadata.json");
  const metadata = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, "utf-8")) : undefined;
  return {
    runId,
    outputDir,
    stdout,
    stderr,
    reportUrl: `/api/runs/${runId}/diagnosis.md`,
    pdfUrl: `/api/runs/${runId}/diagnosis.pdf`,
    paramsUrl: `/api/runs/${runId}/diagnosis_recommendations.params`,
    charts: charts.map((file) => ({ name: file, url: `/api/runs/${runId}/${file}` })),
    chartDataUrl,
    metadata,
    finishedAt: new Date().toISOString(),
  };
}

export function startDiagnosisJob({ runId, outputDir, command, args, apiKey }: StartDiagnosisJobInput) {
  let stdout = "";
  let stderr = "";
  const startedAt = new Date().toISOString();

  writeStatus(outputDir, {
    runId,
    state: "running",
    step: "已保存输入文件，正在启动 Python 诊断...",
    progress: 15,
    startedAt,
  });

  const child = spawn(command, args, {
    cwd: backendCwd(),
    env: { ...process.env, ...(apiKey ? { LLM_API_KEY: apiKey } : {}) },
    windowsHide: true,
  });

  writeStatus(outputDir, {
    runId,
    state: "running",
    step: "正在解析日志、提取指标、生成图表和报告...",
    progress: 35,
    startedAt,
    pid: child.pid,
  });

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
    const text = stdout;
    let step = "正在解析日志、提取指标、生成图表和报告...";
    let progress = 45;
    if (text.includes("LLM 调用失败") || text.includes("以下是规则诊断结果")) {
      step = "规则诊断已完成，正在保存报告和参数文件...";
      progress = 80;
    }
    if (text.includes("诊断报告已保存")) {
      step = "报告已保存，正在收尾...";
      progress = 90;
    }
    writeStatus(outputDir, { runId, state: "running", step, progress, startedAt, stdoutTail: text.slice(-2000) });
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    writeStatus(outputDir, {
      runId,
      state: "running",
      step: "诊断运行中，收到诊断程序输出...",
      progress: 50,
      startedAt,
      stderrTail: stderr.slice(-2000),
    });
  });

  child.on("error", (error) => {
    writeStatus(outputDir, {
      runId,
      state: "error",
      step: "诊断启动失败",
      progress: 100,
      startedAt,
      error: error.message,
      stdout,
      stderr,
    });
  });

  child.on("close", (code) => {
    if (code !== 0) {
      writeStatus(outputDir, {
        runId,
        state: "error",
        step: "诊断运行失败",
        progress: 100,
        startedAt,
        code,
        stdout,
        stderr,
      });
      return;
    }
    const responseBody = buildDoneResponse(runId, outputDir, stdout, stderr);
    writeFileSync(LATEST_FILE, JSON.stringify(responseBody, null, 2), "utf-8");
    writeStatus(outputDir, {
      ...responseBody,
      state: "done",
      step: "诊断完成",
      progress: 100,
      startedAt,
    });
  });
}
