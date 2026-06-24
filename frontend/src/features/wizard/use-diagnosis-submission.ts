"use client";

import { useRef, useState } from "react";

import { buildRunError } from "./wizard-utils.mjs";
import type { WizardFormState } from "./types";

type DiagnoseResponse = {
  runId?: string;
  error?: string;
  stderr?: string;
  stdout?: string;
  step?: string;
  progress?: number;
};

type DiagnoseStatus = {
  state: "uploading" | "running" | "done" | "error";
  step?: string;
  progress?: number;
  error?: string;
  stdoutTail?: string;
  stderrTail?: string;
  runId: string;
};

export function useDiagnosisSubmission(onDone: (runId: string) => void) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeRunId, setActiveRunId] = useState("");
  const [error, setError] = useState("");
  const [clientStatus, setClientStatus] = useState("页面已加载，等待开始诊断");
  const pollingRef = useRef(false);

  async function pollDiagnosis(runId: string) {
    setActiveRunId(runId);
    pollingRef.current = true;
    while (pollingRef.current) {
      let res: Response;
      try {
        res = await fetch(`/api/status/${encodeURIComponent(runId)}`, { cache: "no-store" });
      } catch {
        if (!pollingRef.current) return;
        await new Promise((r) => window.setTimeout(r, 1500));
        continue;
      }
      const status = (await res.json()) as DiagnoseStatus;
      if (!res.ok) {
        setError(status.error || "无法读取诊断进度");
        setLoading(false);
        pollingRef.current = false;
        return;
      }
      setProgress(status.progress ?? 0);
      setClientStatus(status.step || `诊断状态：${status.state}`);
      if (status.state === "done") {
        pollingRef.current = false;
        setLoading(false);
        setProgress(100);
        onDone(runId);
        return;
      }
      if (status.state === "error") {
        pollingRef.current = false;
        setLoading(false);
        setError(buildRunError(status));
        return;
      }
      await new Promise((r) => window.setTimeout(r, 1500));
    }
  }

  async function submit(form: WizardFormState) {
    setLoading(true);
    setProgress(5);
    setActiveRunId("");
    setError("");
    setClientStatus("正在上传文件并启动诊断...");

    try {
      const fd = new FormData();
      fd.set("logfile", form.logfile);
      fd.set("paramsFile", form.paramsFile);
      fd.set("question", form.question);
      fd.set("apiBase", form.apiBase);
      fd.set("apiKey", form.apiKey);
      fd.set("model", form.model);
      fd.set("testTime", form.testTime);
      fd.set("testLocation", form.testLocation);
      fd.set("testProject", form.testProject);
      fd.set("testOperator", form.testOperator);
      fd.set("testAircraft", form.testAircraft);
      if (form.logUpload) fd.set("logfileUpload", form.logUpload);
      if (form.paramsUpload) fd.set("paramsUpload", form.paramsUpload);

      const res = await fetch("/api/diagnose", { method: "POST", body: fd });
      setClientStatus(`服务器已响应：HTTP ${res.status}`);
      const data = (await res.json()) as DiagnoseResponse;
      if (!res.ok) {
        setError(`${data.error ?? "诊断失败"}\n${data.stderr ?? ""}\n${data.stdout ?? ""}`.trim());
        setLoading(false);
        return;
      }
      if (res.status === 202 && data.runId) {
        setClientStatus(data.step || "诊断任务已启动，正在轮询进度...");
        setProgress(data.progress ?? 15);
        await pollDiagnosis(data.runId);
        return;
      }
      // 非 202 直接完成（兜底）
      if (data.runId) {
        setLoading(false);
        onDone(data.runId);
      }
    } catch (e) {
      setClientStatus("诊断请求失败");
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  function abandon() {
    pollingRef.current = false;
    setLoading(false);
    setActiveRunId("");
    setProgress(0);
    setClientStatus("已放弃等待，可重新开始诊断");
  }

  return { loading, progress, activeRunId, error, clientStatus, submit, abandon };
}
