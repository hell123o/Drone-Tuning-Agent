import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ChartsPanel } from "./charts-panel";
import { LogsPanel } from "./logs-panel";
import { ParamsPanel } from "./params-panel";
import { ReportPanel } from "./report-panel";
import type { DiagnosisRunState } from "./types";

type ResultTabsProps = {
  diagnosis: DiagnosisRunState;
};

const RESULT_TABS = [
  { value: "report", label: "诊断报告" },
  { value: "charts", label: "分析图表" },
  { value: "params", label: "参数建议" },
  { value: "logs", label: "运行日志" },
] as const;

export function ResultTabs({ diagnosis }: ResultTabsProps) {
  return (
    <div className="space-y-4">
      {diagnosis.error ? (
        <Alert variant="destructive" className="bg-white">
          <AlertTitle>运行失败</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap font-mono text-xs">{diagnosis.error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="report" className="w-full">
        <div className="flex flex-col gap-3 rounded-2xl border bg-white/90 p-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">诊断输出</h2>
            <p className="mt-1 text-sm text-muted-foreground">报告、图表、参数文件和 Python 输出会在这里汇总。</p>
          </div>
          <TabsList className="grid w-full grid-cols-4 md:w-auto">
            {RESULT_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="report" className="mt-4">
          <ReportPanel diagnosis={diagnosis} />
        </TabsContent>
        <TabsContent value="charts" className="mt-4">
          <ChartsPanel diagnosis={diagnosis} />
        </TabsContent>
        <TabsContent value="params" className="mt-4">
          <ParamsPanel diagnosis={diagnosis} />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <LogsPanel diagnosis={diagnosis} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
