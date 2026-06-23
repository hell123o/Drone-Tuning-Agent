"use client";

import { useEffect, useState } from "react";

import { buildRunError, initialTestTime } from "./client-utils.mjs";
import type { DiagnoseResult, DiagnoseStatus, DiagnosisRunState } from "./types";

export function useDiagnosisRun(): DiagnosisRunState {
  const [logfile, setLogfile] = useState("");
  const [paramsFile, setParamsFile] = useState("");
  const [question, setQuestion] = useState("");
  const [apiBase, setApiBase] = useState("http://192.168.2.158:8310/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [testTime, setTestTime] = useState(initialTestTime);
  const [testLocation, setTestLocation] = useState("");
  const [testProject, setTestProject] = useState("");
  const [testOperator, setTestOperator] = useState("");
  const [testAircraft, setTestAircraft] = useState("X760");
  const [logUpload, setLogUpload] = useState<File | null>(null);
  const [paramsUpload, setParamsUpload] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientStatus, setClientStatus] = useState("页面已加载，等待开始诊断");
  const [progress, setProgress] = useState(0);
  const [activeRunId, setActiveRunId] = useState("");
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [report, setReport] = useState("");
  const [paramsPreview, setParamsPreview] = useState("");
  const [chartData, setChartData] = useState<DiagnosisRunState["chartData"]>(null);

  async function loadResult(data: DiagnoseResult, statusText = "诊断完成") {
    setResult(data);
    setClientStatus(statusText);
    const [reportText, paramsText, chartDataJson] = await Promise.all([
      fetch(data.reportUrl).then((res) => res.text()),
      fetch(data.paramsUrl).then((res) => res.text()),
      data.chartDataUrl
        ? fetch(data.chartDataUrl)
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    setReport(reportText);
    setParamsPreview(paramsText);
    setChartData(chartDataJson);
    setProgress(100);
    setLoading(false);
  }

  async function pollDiagnosis(runId: string) {
    setActiveRunId(runId);
    for (;;) {
      const response = await fetch(`/api/status/${encodeURIComponent(runId)}`, { cache: "no-store" });
      const status = (await response.json()) as DiagnoseStatus;
      if (!response.ok) throw new Error(status.error || "无法读取诊断进度");

      setProgress(status.progress ?? 0);
      setClientStatus(status.step || `诊断状态：${status.state}`);

      if (status.state === "done") {
        await loadResult(status as DiagnoseResult, "诊断完成");
        return;
      }
      if (status.state === "error") {
        setLoading(false);
        setError(buildRunError(status));
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
  }

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (loading) return;
      try {
        const response = await fetch("/api/latest", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!data?.runId || data.runId === result?.runId) return;
        await loadResult(data, `已自动载入最近诊断：${data.runId}`);
      } catch {
        // Latest polling is opportunistic; manual diagnosis should not depend on it.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loading, result?.runId]);

  async function startDiagnose() {
    setClientStatus(`已点击开始诊断：${new Date().toLocaleTimeString()}`);
    if (!logUpload && !logfile.trim()) {
      setError("请先选择飞行日志文件，或填写服务器本机日志路径。");
      return;
    }

    setLoading(true);
    setClientStatus("正在上传文件并启动诊断...");
    setProgress(5);
    setActiveRunId("");
    setError("");
    setResult(null);
    setReport("");
    setParamsPreview("");
    setChartData(null);

    try {
      const form = new FormData();
      form.set("logfile", logfile);
      form.set("paramsFile", paramsFile);
      form.set("question", question);
      form.set("apiBase", apiBase);
      form.set("apiKey", apiKey);
      form.set("model", model);
      form.set("testTime", testTime);
      form.set("testLocation", testLocation);
      form.set("testProject", testProject);
      form.set("testOperator", testOperator);
      form.set("testAircraft", testAircraft);
      if (logUpload) form.set("logfileUpload", logUpload);
      if (paramsUpload) form.set("paramsUpload", paramsUpload);

      const response = await fetch("/api/diagnose", {
        method: "POST",
        body: form,
      });
      setClientStatus(`服务器已响应：HTTP ${response.status}`);
      const data = await response.json();
      if (!response.ok) {
        setError(`${data.error ?? "诊断失败"}\n${data.stderr ?? ""}\n${data.stdout ?? ""}`.trim());
        return;
      }

      if (response.status === 202 && data.runId) {
        setClientStatus(data.step || "诊断任务已启动，正在轮询进度...");
        setProgress(data.progress ?? 15);
        await pollDiagnosis(data.runId);
        return;
      }

      await loadResult(data, "诊断完成");
    } catch (diagnoseError) {
      setClientStatus("诊断请求失败");
      setError(diagnoseError instanceof Error ? diagnoseError.message : String(diagnoseError));
    } finally {
      setLoading(false);
    }
  }

  return {
    logfile,
    setLogfile,
    paramsFile,
    setParamsFile,
    question,
    setQuestion,
    apiBase,
    setApiBase,
    apiKey,
    setApiKey,
    model,
    setModel,
    testTime,
    setTestTime,
    testLocation,
    setTestLocation,
    testProject,
    setTestProject,
    testOperator,
    setTestOperator,
    testAircraft,
    setTestAircraft,
    logUpload,
    setLogUpload,
    paramsUpload,
    setParamsUpload,
    loading,
    error,
    clientStatus,
    progress,
    activeRunId,
    result,
    report,
    paramsPreview,
    chartData,
    startDiagnose,
  };
}
