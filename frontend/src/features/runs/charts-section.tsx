"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChartLightbox, type ChartLightboxTarget } from "@/features/charts/chart-lightbox";
import { InteractiveChart } from "@/features/charts/interactive-chart";
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
      <div className="grid gap-4 2xl:grid-cols-2">
        {interactive.map((chart) => (
          <InteractiveChart
            key={chart.id}
            chart={chart}
            onExpand={(target) => setLightbox({ type: "interactive", chart: target })}
          />
        ))}
        <ChartLightbox target={lightbox} onClose={() => setLightbox(null)} />
      </div>
    );
  }

  if (!charts?.length) {
    return <p className="text-sm text-muted-foreground">暂无图表</p>;
  }

  return (
    <>
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
    </>
  );
}
