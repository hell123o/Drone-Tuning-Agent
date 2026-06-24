import { Download, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";

type ReportSectionProps = {
  reportUrl: string;
  pdfUrl?: string;
  reportText: string;
};

export function ReportSection({ reportUrl, pdfUrl, reportText }: ReportSectionProps) {
  const effectivePdfUrl = pdfUrl ?? reportUrl.replace(/diagnosis\.md$/, "diagnosis.pdf");
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => window.open(reportUrl, "_blank", "noopener,noreferrer")}
        >
          <FileText className="size-4" /> 打开 .md
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => window.open(effectivePdfUrl, "_blank", "noopener,noreferrer")}
        >
          <Download className="size-4" /> 下载 PDF
        </Button>
      </div>
      <article className="prose max-w-none prose-headings:tracking-tight prose-pre:bg-muted prose-code:text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportText}</ReactMarkdown>
      </article>
    </div>
  );
}
