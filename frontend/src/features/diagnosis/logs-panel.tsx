import { Bot } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { DiagnosisRunState } from "./types";

type LogsPanelProps = {
  diagnosis: DiagnosisRunState;
};

export function LogsPanel({ diagnosis }: LogsPanelProps) {
  const output = diagnosis.result ? `${diagnosis.result.stdout}\n${diagnosis.result.stderr ?? ""}` : "暂无运行输出。";

  return (
    <Card className="bg-white/95 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="size-5 text-primary" /> Python 运行输出
        </CardTitle>
        <CardDescription>用于排查环境、依赖和 LLM 连接问题。</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="h-[520px] rounded-xl border bg-foreground p-4">
          <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-100">{output}</pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
