"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RunSummary } from "@/features/runs/types";
import { formatRunTime, shortRunId, statusColor } from "@/features/runs/run-utils.mjs";

export function AppSidebar() {
  const [runs, setRuns] = useState<RunSummary[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.runs)) {
          setRuns(data.runs.slice(0, 8));
        }
      } catch {
        // 静默
      }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <Radar className="size-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">Drone Tuning Agent</span>
      </div>

      <div className="px-4">
        <Link href="/">
          <Button variant="default" className="w-full gap-2" size="sm">
            <Plus className="size-4" />
            新建诊断
          </Button>
        </Link>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto px-4">
        <p className="px-1 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          运行历史
        </p>
        <div className="space-y-0.5">
          {runs.length === 0 ? (
            <p className="px-1 py-4 text-xs text-muted-foreground">暂无运行记录</p>
          ) : (
            runs.map((run) => (
              <Link
                key={run.runId}
                href={`/runs/${run.runId}`}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-muted"
              >
                <span className={`size-1.5 shrink-0 rounded-full ${statusColor(run.state)}`} />
                <span className="min-w-0 flex-1 truncate font-mono">{shortRunId(run.runId)}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatRunTime(run.updatedAt).slice(5, 16) || ""}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-3">
        <Link
          href="/runs"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          查看全部 →
        </Link>
      </div>
    </div>
  );
}
