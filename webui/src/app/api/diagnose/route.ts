import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const PROJECT_ROOT = process.env.DRONE_AGENT_PROJECT_ROOT || path.resolve(process.cwd(), "..");
const RUNS_ROOT = path.join(PROJECT_ROOT, "webui_runs");
const LATEST_FILE = path.join(RUNS_ROOT, "latest.json");
const WINDOWS_CLI_EXE = path.join(PROJECT_ROOT, "drone-agent-cli.exe");
const WINDOWS_PYTHON = path.join(PROJECT_ROOT, ".venv-win", "Scripts", "python.exe");
const WSL_PYTHON = path.join(PROJECT_ROOT, ".venv", "bin", "python");

type DiagnoseInput = {
  logfile?: string;
  paramsFile?: string;
  question?: string;
  hardwareFile?: string;
  hardwareProfile?: string;
  apiBase?: string;
  apiKey?: string;
  model?: string;
  uploadedLog?: File;
  uploadedParams?: File;
  metadata?: Record<string, string>;
};

const METADATA_FIELDS = ["testTime", "testLocation", "testProject", "testOperator", "testAircraft", "takeoffWeightKg"] as const;

function readMetadataFromForm(form: FormData) {
  const metadata: Record<string, string> = {};
  for (const key of METADATA_FIELDS) {
    const value = String(form.get(key) || "").trim();
    if (value) metadata[key] = value;
  }
  return metadata;
}

function pickPython() {
  if (existsSync(WINDOWS_CLI_EXE)) return WINDOWS_CLI_EXE;
  if (existsSync(WINDOWS_PYTHON)) return WINDOWS_PYTHON;
  if (process.platform !== "win32" && existsSync(WSL_PYTHON)) return WSL_PYTHON;
  return "python";
}

function safeRunId(logfile: string) {
  const base = path.basename(logfile || "flight-log").replace(/[^a-zA-Z0-9_.-]+/g, "_");
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${stamp}_${base}`;
}

function safeFileName(name: string) {
  return path.basename(name || "input").replace(/[^a-zA-Z0-9_.\-\u4e00-\u9fa5]+/g, "_");
}

function normalizeLocalPath(input?: string) {
  const value = input?.trim();
  if (!value) return "";
  if (process.platform === "win32") return value;
  const match = value.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (!match) return value;
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, "/");
  return `/mnt/${drive}/${rest}`;
}

function statusPath(outputDir: string) {
  return path.join(outputDir, "status.json");
}

function writeStatus(outputDir: string, status: Record<string, unknown>) {
  writeFileSync(
    statusPath(outputDir),
    JSON.stringify({ updatedAt: new Date().toISOString(), ...status }, null, 2),
    "utf-8",
  );
}

async function parseInput(request: NextRequest): Promise<DiagnoseInput> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const uploadedLog = form.get("logfileUpload");
    const uploadedParams = form.get("paramsUpload");
    return {
      logfile: String(form.get("logfile") || ""),
      paramsFile: String(form.get("paramsFile") || ""),
      question: String(form.get("question") || ""),
      hardwareFile: String(form.get("hardwareFile") || ""),
      hardwareProfile: String(form.get("hardwareProfile") || ""),
      apiBase: String(form.get("apiBase") || ""),
      apiKey: String(form.get("apiKey") || ""),
      model: String(form.get("model") || ""),
      uploadedLog: uploadedLog instanceof File && uploadedLog.size > 0 ? uploadedLog : undefined,
      uploadedParams: uploadedParams instanceof File && uploadedParams.size > 0 ? uploadedParams : undefined,
      metadata: readMetadataFromForm(form),
    };
  }
  return (await request.json()) as DiagnoseInput;
}

function buildDoneResponse(runId: string, outputDir: string, stdout: string, stderr: string) {
  const files = existsSync(outputDir) ? readdirSync(outputDir) : [];
  const charts = files.filter((file) => file.endsWith(".png"));
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
    snapshotUrl: `/api/runs/${runId}/snapshot.json`,
    charts: charts.map((file) => ({ name: file, url: `/api/runs/${runId}/${file}` })),
    metadata,
    finishedAt: new Date().toISOString(),
  };
}

function startDiagnosisJob({
  runId,
  outputDir,
  args,
  apiKey,
}: {
  runId: string;
  outputDir: string;
  args: string[];
  apiKey?: string;
}) {
  let stdout = "";
  let stderr = "";
  const startedAt = new Date().toISOString();
  writeStatus(outputDir, {
    runId,
    state: "running",
    step: "已上传文件，正在启动 Python 诊断...",
    progress: 15,
    startedAt,
  });

  const child = spawn(pickPython(), args, {
    cwd: PROJECT_ROOT,
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

export async function POST(request: NextRequest) {
  const body = await parseInput(request);
  let logfile = normalizeLocalPath(body.logfile);
  let paramsFile = normalizeLocalPath(body.paramsFile);
  const hardwareFile = normalizeLocalPath(body.hardwareFile);
  const hardwareProfile = body.hardwareProfile?.trim();

  if (!logfile && !body.uploadedLog) {
    return NextResponse.json({ error: "请选择飞行日志文件，或填写日志文件路径" }, { status: 400 });
  }

  mkdirSync(RUNS_ROOT, { recursive: true });
  const runId = safeRunId(logfile || body.uploadedLog?.name || "flight-log");
  const outputDir = path.join(RUNS_ROOT, runId);
  mkdirSync(outputDir, { recursive: true });

  writeStatus(outputDir, {
    runId,
    state: "uploading",
    step: "正在保存上传文件...",
    progress: 5,
    startedAt: new Date().toISOString(),
  });

  if (body.uploadedLog) {
    logfile = path.join(outputDir, safeFileName(body.uploadedLog.name));
    writeFileSync(logfile, Buffer.from(await body.uploadedLog.arrayBuffer()));
  }

  if (body.uploadedParams) {
    paramsFile = path.join(outputDir, safeFileName(body.uploadedParams.name));
    writeFileSync(paramsFile, Buffer.from(await body.uploadedParams.arrayBuffer()));
  }

  let metadataFile = "";
  if (body.metadata && Object.values(body.metadata).some((value) => value?.trim())) {
    metadataFile = path.join(outputDir, "test_metadata.json");
    writeFileSync(metadataFile, JSON.stringify(body.metadata, null, 2), "utf-8");
  }

  const command = pickPython();
  const args = command === WINDOWS_CLI_EXE ? [logfile, "--output", outputDir] : ["main.py", logfile, "--output", outputDir];
  if (paramsFile) args.push("-p", paramsFile);
  if (body.question?.trim()) args.push("-q", body.question.trim());
  if (hardwareProfile) args.push("--profile", hardwareProfile);
  if (hardwareFile) args.push("--hardware", hardwareFile);
  if (body.apiBase?.trim()) args.push("--api-base", body.apiBase.trim());
  if (body.model?.trim()) args.push("--model", body.model.trim());
  if (metadataFile) args.push("--metadata", metadataFile);

  startDiagnosisJob({ runId, outputDir, args, apiKey: body.apiKey?.trim() });

  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    return new NextResponse(null, {
      status: 303,
      headers: { Location: `/progress/${encodeURIComponent(runId)}` },
    });
  }

  return NextResponse.json(
    {
      runId,
      outputDir,
      state: "running",
      step: "已上传文件，诊断任务已启动",
      progress: 15,
      statusUrl: `/api/status/${runId}`,
    },
    { status: 202 },
  );
}
