// src/features/wizard/step-running.tsx
"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { clampProgress } from "./wizard-utils.mjs";

type StepRunningProps = {
  progress: number;
  clientStatus: string;
  activeRunId: string;
  error: string;
  onAbandon: () => void;
  onRetry: () => void;
};

export function StepRunning({
  progress,
  clientStatus,
  activeRunId,
  error,
  onAbandon,
  onRetry,
}: StepRunningProps) {
  const [showLogs, setShowLogs] = useState(false);

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTitle>运行失败</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
            {error}
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onAbandon}>
            返回向导
          </Button>
          <Button onClick={onRetry}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-6 py-10">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在分析飞行日志...</p>
        <div className="w-full max-w-md">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${clampProgress(progress)}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {clientStatus} · {Math.round(clampProgress(progress))}%
          </p>
        </div>
        {activeRunId && (
          <p className="font-mono text-xs text-muted-foreground">Run ID: {activeRunId}</p>
        )}
        <Button variant="outline" size="sm" onClick={onAbandon}>
          放弃等待
        </Button>
      </div>

      <details className="group rounded-xl border border-border/60" open={showLogs}>
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium"
          onClick={(e) => {
            e.preventDefault();
            setShowLogs(!showLogs);
          }}
        >
          <span>查看详细输出</span>
          <ChevronDown className={"size-4 text-muted-foreground transition " + (showLogs ? "rotate-180" : "")} />
        </summary>
        {showLogs && (
          <ScrollArea className="h-48 rounded-b-xl bg-foreground p-4">
            <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-100">
              {clientStatus}
            </pre>
          </ScrollArea>
        )}
      </details>
    </div>
  );
}
