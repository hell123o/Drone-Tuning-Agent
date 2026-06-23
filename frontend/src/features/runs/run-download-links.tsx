import { Download, FileText, SlidersHorizontal } from "lucide-react";

import type { RunArtifact, RunStatus } from "./types";

type RunDownloadLinksProps = {
  run: RunArtifact | RunStatus;
};

const linkClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium transition hover:bg-muted";

export function RunDownloadLinks({ run }: RunDownloadLinksProps) {
  if (!run.reportUrl || !run.paramsUrl) {
    return null;
  }

  const pdfUrl = run.pdfUrl ?? run.reportUrl.replace(/diagnosis\.md$/, "diagnosis.pdf");

  return (
    <div className="flex flex-wrap gap-3">
      <a className={linkClass} href={run.reportUrl} target="_blank">
        <FileText className="size-4 text-primary" />
        打开 Markdown 报告
      </a>
      <a className={linkClass} href={pdfUrl} target="_blank">
        <Download className="size-4 text-primary" />
        下载 PDF 报告
      </a>
      <a className={linkClass} href={run.paramsUrl} target="_blank">
        <SlidersHorizontal className="size-4 text-primary" />
        下载完整参数文件
      </a>
    </div>
  );
}
