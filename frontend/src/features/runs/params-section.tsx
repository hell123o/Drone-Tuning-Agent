import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type ParamsSectionProps = {
  paramsUrl: string;
  paramsPreview: string;
};

export function ParamsSection({ paramsUrl, paramsPreview }: ParamsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">可导入 QGroundControl 的参数建议文件。</p>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => window.open(paramsUrl, "_blank", "noopener,noreferrer")}
        >
          <Download className="size-4" /> 下载 .params
        </Button>
      </div>
      <ScrollArea className="h-[460px] rounded-xl border border-border/60 bg-muted p-4">
        <pre className="font-mono text-sm leading-6 text-foreground">{paramsPreview}</pre>
      </ScrollArea>
    </div>
  );
}
