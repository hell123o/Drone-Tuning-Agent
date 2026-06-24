"use client";

import { useState } from "react";
import { ChevronDown, Terminal } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";

type LogsCollapsibleProps = {
  stdout?: string;
  stderr?: string;
};

export function LogsCollapsible({ stdout, stderr }: LogsCollapsibleProps) {
  const [open, setOpen] = useState(false);
  const output = `${stdout ?? ""}\n${stderr ?? ""}`.trim() || "暂无运行输出。";

  return (
    <div className="rounded-xl border border-border/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Terminal className="size-4 text-muted-foreground" />
          查看 Python 运行输出
        </span>
        <ChevronDown className={"size-4 text-muted-foreground transition " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <ScrollArea className="h-64 rounded-b-xl bg-foreground p-4">
          <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-100">{output}</pre>
        </ScrollArea>
      )}
    </div>
  );
}
