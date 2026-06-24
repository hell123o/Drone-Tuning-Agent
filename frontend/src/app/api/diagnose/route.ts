import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import { parseDiagnoseInput } from "@/lib/server/diagnosis-input";
import { pickPython, startDiagnosisJob, writeStatus } from "@/lib/server/diagnosis-runner";
import { RUNS_ROOT } from "@/lib/server/paths";
import { buildPythonArgs, normalizeLocalPath, safeFileName, safeRunId } from "@/lib/server/diagnosis-utils.mjs";

export async function POST(request: NextRequest) {
  const body = await parseDiagnoseInput(request);
  let logfile = normalizeLocalPath(body.logfile);
  let paramsFile = normalizeLocalPath(body.paramsFile);
  const hardwareFile = normalizeLocalPath(body.hardwareFile);

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
  const args = buildPythonArgs({
    command,
    logfile,
    outputDir,
    paramsFile,
    question: body.question,
    hardwareFile,
    apiBase: body.apiBase,
    model: body.model,
    metadataFile,
  });

  startDiagnosisJob({ runId, outputDir, command, args, apiKey: body.apiKey?.trim() });

  return NextResponse.json(
    {
      runId,
      outputDir,
      state: "running",
      step: "已保存输入文件，诊断任务已启动",
      progress: 15,
      statusUrl: `/api/status/${runId}`,
    },
    { status: 202 },
  );
}
