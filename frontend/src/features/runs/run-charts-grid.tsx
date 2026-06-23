"use client";

import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChartLightbox, type ChartLightboxTarget } from "@/features/charts/chart-lightbox";
import { InteractiveChart } from "@/features/charts/interactive-chart";
import type { InteractiveChartSpec } from "@/features/charts/types";

import type { RunChart, RunChartData } from "./types";

type RunChartsGridProps = {
  charts?: RunChart[];
  chartDataUrl?: string;
};

export function RunChartsGrid({ charts, chartDataUrl }: RunChartsGridProps) {
  const [chartData, setChartData] = useState<RunChartData | null>(null);
  const [loadedChartDataUrl, setLoadedChartDataUrl] = useState<string | undefined>(undefined);
  const [lightbox, setLightbox] = useState<ChartLightboxTarget | null>(null);

  useEffect(() => {
    if (!chartDataUrl) {
      return;
    }
    let cancelled = false;
    fetch(chartDataUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) {
          setLoadedChartDataUrl(chartDataUrl);
          setChartData(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedChartDataUrl(chartDataUrl);
          setChartData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chartDataUrl]);

  const activeChartData = chartDataUrl && loadedChartDataUrl === chartDataUrl ? chartData : null;

  if (activeChartData?.charts?.length) {
    return (
      <div className="grid gap-4 2xl:grid-cols-2">
        {activeChartData.charts.map((chart) => (
          <InteractiveChart
            key={chart.id}
            chart={chart as InteractiveChartSpec}
            onExpand={(target) => setLightbox({ type: "interactive", chart: target })}
          />
        ))}
        <ChartLightbox target={lightbox} onClose={() => setLightbox(null)} />
      </div>
    );
  }

  if (!charts?.length) {
    return null;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
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
      <ChartLightbox target={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
