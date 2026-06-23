"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartLightbox, type ChartLightboxTarget } from "@/features/charts/chart-lightbox";
import { InteractiveChart } from "@/features/charts/interactive-chart";
import type { InteractiveChartSpec } from "@/features/charts/types";

import { EmptyState } from "./empty-state";
import type { DiagnosisRunState } from "./types";

type ChartsPanelProps = {
  diagnosis: DiagnosisRunState;
};

export function ChartsPanel({ diagnosis }: ChartsPanelProps) {
  const [lightbox, setLightbox] = useState<ChartLightboxTarget | null>(null);
  const charts = diagnosis.result?.charts;
  const interactiveCharts = diagnosis.chartData?.charts as InteractiveChartSpec[] | undefined;

  return (
    <Card className="bg-white/95 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-lg">分析图表</CardTitle>
        <CardDescription>支持悬停查看数值、隐藏曲线、局部缩放和放大查看。旧运行记录会自动回退到 PNG 预览。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {interactiveCharts?.length ? (
          <div className="grid gap-4 2xl:grid-cols-2">
            {interactiveCharts.map((chart) => (
              <InteractiveChart key={chart.id} chart={chart} onExpand={(target) => setLightbox({ type: "interactive", chart: target })} />
            ))}
          </div>
        ) : charts?.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {charts.map((chart) => (
              <figure key={chart.name} className="overflow-hidden rounded-xl border bg-white p-4 shadow-sm">
                <figcaption className="mb-3 flex items-center justify-between gap-3 text-sm font-medium text-foreground">
                  {chart.name}
                  <Button type="button" size="sm" variant="outline" className="gap-1 bg-white" onClick={() => setLightbox({ type: "image", title: chart.name, url: chart.url })}>
                    <Maximize2 className="size-3.5" /> 放大
                  </Button>
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={chart.url} alt={chart.name} className="w-full rounded-lg border bg-white" />
              </figure>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无图表" description="诊断完成后会自动显示分析图，便于快速定位调参问题。" />
        )}
      </CardContent>
      <ChartLightbox target={lightbox} onClose={() => setLightbox(null)} />
    </Card>
  );
}
