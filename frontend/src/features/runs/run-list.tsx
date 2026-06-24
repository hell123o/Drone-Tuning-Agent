"use client";

import { useState } from "react";

import { EmptyState } from "@/components/empty-state";

import { RunSummaryCard } from "./run-summary-card";
import type { RunSummary } from "./types";

type Filter = "all" | "done" | "error" | "running";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "done", label: "完成" },
  { value: "error", label: "失败" },
  { value: "running", label: "运行中" },
];

export function RunList({ runs }: { runs: RunSummary[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = runs.filter((r) => {
    if (filter === "all") return true;
    if (filter === "running") return r.state === "running" || r.state === "uploading";
    return r.state === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={
              "border-b-2 px-1 py-1 text-sm font-medium transition-colors " +
              (filter === f.value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="没有匹配的诊断记录"
          description="尝试切换筛选条件，或点击侧边栏新建诊断。"
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((run) => (
            <RunSummaryCard key={run.runId} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
