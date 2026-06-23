import { Download, FileChartColumn } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import { EmptyState } from "./empty-state";
import type { DiagnosisRunState } from "./types";

type ReportPanelProps = {
  diagnosis: DiagnosisRunState;
};

export function ReportPanel({ diagnosis }: ReportPanelProps) {
  const reportUrl = diagnosis.result?.reportUrl;
  const pdfUrl = diagnosis.result?.pdfUrl ?? reportUrl?.replace(/diagnosis\.md$/, "diagnosis.pdf");

  return (
    <Card className="bg-white/95 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileChartColumn className="size-5 text-primary" /> diagnosis.md
          </CardTitle>
          <CardDescription>{diagnosis.result?.outputDir ?? "诊断完成后，这里会显示 Markdown 报告预览。"}</CardDescription>
        </div>
        {diagnosis.result ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 bg-white"
              onClick={() => window.open(reportUrl, "_blank", "noopener,noreferrer")}
            >
              <Download className="size-4" /> 打开 Markdown
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 bg-white"
              onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")}
            >
              <Download className="size-4" /> 下载 PDF
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="h-[640px] rounded-xl border bg-white p-5">
          {diagnosis.report ? (
            <article className="prose max-w-none prose-headings:tracking-tight prose-pre:bg-muted prose-code:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{diagnosis.report}</ReactMarkdown>
            </article>
          ) : (
            <EmptyState title="还没有报告" description="选择飞行日志文件并点击开始诊断，报告会自动出现在这里。" />
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
