"use client";

import { useRef, useState } from "react";

import { SegmentedNav, type SegmentedNavItem } from "@/components/segmented-nav";

import { ChartsSection } from "./charts-section";
import { LogsCollapsible } from "./logs-collapsible";
import { ParamsSection } from "./params-section";
import { ReportSection } from "./report-section";
import type { RunChartData, RunStatus } from "./types";

const TABS: SegmentedNavItem[] = [
  { value: "report", label: "诊断报告" },
  { value: "charts", label: "分析图表" },
  { value: "params", label: "参数建议" },
  { value: "logs", label: "运行日志" },
];

type RunDetailClientProps = {
  run: RunStatus;
  reportText: string;
  paramsPreview: string;
  chartData: RunChartData | null;
};

export function RunDetailClient({ run, reportText, paramsPreview, chartData }: RunDetailClientProps) {
  const [tab, setTab] = useState("report");
  const logsRef = useRef<HTMLDivElement>(null);

  function handleChange(value: string) {
    if (value === "logs") {
      setTab("report");
      logsRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setTab(value);
  }

  return (
    <div className="space-y-6">
      <SegmentedNav items={TABS} value={tab} onChange={handleChange} />

      <div>
        {tab === "report" && (
          <ReportSection
            reportUrl={run.reportUrl ?? ""}
            pdfUrl={run.pdfUrl}
            reportText={reportText}
          />
        )}
        {tab === "charts" && <ChartsSection charts={run.charts} chartData={chartData} />}
        {tab === "params" && (
          <ParamsSection
            paramsUrl={run.paramsUrl ?? ""}
            paramsPreview={paramsPreview}
          />
        )}
      </div>

      <div ref={logsRef}>
        <LogsCollapsible stdout={run.stdout} stderr={run.stderr} />
      </div>
    </div>
  );
}
