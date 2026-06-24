"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildChartOption } from "./chart-config";
import { EChart } from "./echart";
import type { InteractiveChartSpec } from "./types";

type ChartLightboxTarget =
  | { type: "echart"; chart: InteractiveChartSpec }
  | { type: "image"; title: string; url: string };

type ChartLightboxProps = {
  target: ChartLightboxTarget | null;
  onClose: () => void;
};

export type { ChartLightboxTarget };

export function ChartLightbox({ target, onClose }: ChartLightboxProps) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-7xl flex-col rounded-2xl bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 p-4">
          <h2 className="text-lg font-semibold">
            {target.type === "image" ? target.title : target.chart.title}
          </h2>
          <Button type="button" variant="outline" size="icon" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {target.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={target.url} alt={target.title} className="mx-auto max-h-full max-w-full rounded-xl border border-border/60" />
          ) : (
            <EChart option={buildChartOption(target.chart)} height={560} />
          )}
        </div>
      </div>
    </div>
  );
}
