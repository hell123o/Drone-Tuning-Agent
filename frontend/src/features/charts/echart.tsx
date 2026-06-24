"use client";

import { useEffect, useRef } from "react";
import type { EChartsOption } from "echarts";

import { echarts } from "./echarts-setup";

type EChartProps = {
  option: EChartsOption;
  height?: number;
  className?: string;
};

export function EChart({ option, height = 360, className }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} style={{ height }} className={className} />;
}
