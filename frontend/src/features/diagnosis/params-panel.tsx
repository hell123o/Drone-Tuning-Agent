import { Download, FileSliders } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import { EmptyState } from "./empty-state";
import type { DiagnosisRunState } from "./types";

type ParamsPanelProps = {
  diagnosis: DiagnosisRunState;
};

export function ParamsPanel({ diagnosis }: ParamsPanelProps) {
  return (
    <Card className="bg-white/95 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSliders className="size-5 text-primary" /> diagnosis_recommendations.params
          </CardTitle>
          <CardDescription>可导入 QGroundControl 的参数建议文件。</CardDescription>
        </div>
        {diagnosis.result ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 bg-white"
            onClick={() => window.open(diagnosis.result?.paramsUrl, "_blank", "noopener,noreferrer")}
          >
            <Download className="size-4" /> 下载参数
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="h-[460px] rounded-xl border bg-foreground p-4">
          {diagnosis.paramsPreview ? (
            <pre className="text-sm leading-6 text-emerald-100">{diagnosis.paramsPreview}</pre>
          ) : (
            <EmptyState title="暂无参数文件" description="诊断完成后，这里会显示可下载的建议参数。" />
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
