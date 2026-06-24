"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildChartOption } from "@/features/charts/chart-config";
import { ChartLightbox, type ChartLightboxTarget } from "@/features/charts/chart-lightbox";
import { EChart } from "@/features/charts/echart";
import type { InteractiveChartSpec } from "@/features/charts/types";

import type { RunChart, RunChartData } from "./types";

type ChartsSectionProps = {
  charts?: RunChart[];
  chartData?: RunChartData | null;
};

export function ChartsSection({ charts, chartData }: ChartsSectionProps) {
  const [lightbox, setLightbox] = useState<ChartLightboxTarget | null>(null);
  const interactive = chartData?.charts as InteractiveChartSpec[] | undefined;

  if (interactive?.length) {
    return (
      <div className="space-y-4">
        {interactive.map((chart) => (
          <div key={chart.id} className="rounded-xl border border-border/60 bg-background p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">{chart.title}</h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => setLightbox({ type: "echart", chart })}
              >
                <Maximize2 className="size-3.5" /> 放大
              </Button>
            </div>
            <EChart option={buildChartOption(chart)} height={360} />
          </div>
        ))}
        <ChartLightbox target={lightbox} onClose={() => setLightbox(null)} />
      </div>
    );
  }

  if (!charts?.length) {
    return <p className="text-sm text-muted-foreground">暂无图表</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">该运行无交互数据，显示静态图。</p>
      <div className="grid gap-4 md:grid-cols-2">
        {charts.map((chart) => (
          <figure key={chart.name} className="overflow-hidden rounded-xl border border-border/60 bg-background p-4">
            <figcaption className="mb-3 flex items-center justify-between gap-3 text-sm font-medium">
              {chart.name}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => setLightbox({ type: "image", title: chart.name, url: chart.url })}
              >
                <Maximize2 className="size-3.5" /> 放大
              </Button>
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chart.url} alt={chart.name} className="w-full rounded-lg border border-border/60" />
          </figure>
        ))}
      </div>
      <ChartLightbox target={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
