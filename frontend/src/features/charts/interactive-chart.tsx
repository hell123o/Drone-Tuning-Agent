"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, RotateCcw, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { InteractiveChartSpec } from "./types";

type InteractiveChartProps = {
  chart: InteractiveChartSpec;
  onExpand?: (chart: InteractiveChartSpec) => void;
};

const WIDTH = 900;
const HEIGHT = 360;
const PAD = { left: 54, right: 24, top: 24, bottom: 42 };

export function InteractiveChart({ chart, onExpand }: InteractiveChartProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  const visibleSeries = chart.series.filter((series) => !hidden.has(series.name) && series.points.length);
  const domain = useMemo(() => computeDomain(visibleSeries, range), [visibleSeries, range]);
  const hovered = hoverX === null ? null : nearestAtX(visibleSeries, hoverX);

  function toggleSeries(name: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const x = invertX(localX, domain.xMin, domain.xMax);
    setHoverX(Math.max(domain.xMin, Math.min(domain.xMax, x)));
  }

  function zoomToHover() {
    if (hoverX === null) return;
    const span = Math.max(1, (domain.xMax - domain.xMin) / 4);
    setRange([Math.max(domain.fullXMin, hoverX - span / 2), Math.min(domain.fullXMax, hoverX + span / 2)]);
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold">{chart.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            移动鼠标查看数值，点击图例隐藏曲线，使用缩放聚焦局部区间。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1 bg-white" onClick={zoomToHover} disabled={hoverX === null}>
            <ZoomIn className="size-3.5" /> 缩放
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1 bg-white" onClick={() => setRange(null)}>
            <RotateCcw className="size-3.5" /> 重置
          </Button>
          {onExpand ? (
            <Button type="button" size="sm" variant="outline" className="bg-white" onClick={() => onExpand(chart)}>
              放大查看
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {chart.series.map((series) => {
          const isHidden = hidden.has(series.name);
          return (
            <button
              key={series.name}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted"
              onClick={() => toggleSeries(series.name)}
            >
              {isHidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              <span className="size-2 rounded-full" style={{ backgroundColor: series.color }} />
              {series.name}
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border bg-slate-50">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[320px] w-full touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverX(null)}
          onDoubleClick={() => setRange(null)}
          role="img"
          aria-label={chart.title}
        >
          <rect width={WIDTH} height={HEIGHT} fill="#f8fafc" />
          {gridLines(domain).map((line) => (
            <g key={line.value}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={line.y} y2={line.y} stroke="#dbeafe" strokeWidth="1" />
              <text x={PAD.left - 8} y={line.y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                {formatNumber(line.value)}
              </text>
            </g>
          ))}
          {chart.thresholds?.map((threshold) => {
            const y = scaleY(threshold.value, domain.yMin, domain.yMax);
            return (
              <g key={threshold.label}>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke={threshold.color} strokeDasharray="5 5" strokeWidth="1.2" />
                <text x={WIDTH - PAD.right - 4} y={y - 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                  {threshold.label}
                </text>
              </g>
            );
          })}
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} stroke="#94a3b8" />
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#94a3b8" />

          {visibleSeries.map((series) => (
            <path key={series.name} d={pathForSeries(series.points, domain)} fill="none" stroke={series.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          ))}

          {hovered ? (
            <g>
              <line x1={scaleX(hovered.x, domain.xMin, domain.xMax)} x2={scaleX(hovered.x, domain.xMin, domain.xMax)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#1e40af" strokeDasharray="4 4" />
              <rect x={WIDTH - 220} y={PAD.top} width="196" height={24 + hovered.values.length * 18} rx="8" fill="white" stroke="#bfdbfe" />
              <text x={WIDTH - 206} y={PAD.top + 18} className="fill-slate-700 text-[12px]">
                x={formatNumber(hovered.x)}
              </text>
              {hovered.values.map((value, index) => (
                <text key={value.name} x={WIDTH - 206} y={PAD.top + 38 + index * 18} className="fill-slate-600 text-[12px]">
                  {value.name}: {formatNumber(value.y)} {value.unit ?? ""}
                </text>
              ))}
            </g>
          ) : null}

          <text x={(PAD.left + WIDTH - PAD.right) / 2} y={HEIGHT - 10} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {chart.xLabel ?? "Sample"}
          </text>
          <text x="14" y={(PAD.top + HEIGHT - PAD.bottom) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(PAD.top + HEIGHT - PAD.bottom) / 2})`} className="fill-slate-500 text-[11px]">
            {chart.yLabel ?? "Value"}
          </text>
        </svg>
      </div>
    </div>
  );
}

function computeDomain(series: InteractiveChartSpec["series"], range: [number, number] | null) {
  const allPoints = series.flatMap((item) => item.points);
  const fullXMin = Math.min(...allPoints.map(([x]) => x), 0);
  const fullXMax = Math.max(...allPoints.map(([x]) => x), 1);
  const xMin = range?.[0] ?? fullXMin;
  const xMax = range?.[1] ?? fullXMax;
  const visiblePoints = allPoints.filter(([x]) => x >= xMin && x <= xMax);
  const yValues = visiblePoints.length ? visiblePoints.map(([, y]) => y) : allPoints.map(([, y]) => y);
  const rawYMin = Math.min(...yValues, 0);
  const rawYMax = Math.max(...yValues, 1);
  const padding = Math.max((rawYMax - rawYMin) * 0.12, 1);
  return {
    fullXMin,
    fullXMax,
    xMin,
    xMax: xMax === xMin ? xMin + 1 : xMax,
    yMin: rawYMin - padding,
    yMax: rawYMax + padding,
  };
}

function scaleX(x: number, xMin: number, xMax: number) {
  return PAD.left + ((x - xMin) / (xMax - xMin || 1)) * (WIDTH - PAD.left - PAD.right);
}

function scaleY(y: number, yMin: number, yMax: number) {
  return HEIGHT - PAD.bottom - ((y - yMin) / (yMax - yMin || 1)) * (HEIGHT - PAD.top - PAD.bottom);
}

function invertX(localX: number, xMin: number, xMax: number) {
  return xMin + ((localX - PAD.left) / (WIDTH - PAD.left - PAD.right)) * (xMax - xMin);
}

function pathForSeries(points: [number, number][], domain: ReturnType<typeof computeDomain>) {
  return points
    .filter(([x]) => x >= domain.xMin && x <= domain.xMax)
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${scaleX(x, domain.xMin, domain.xMax).toFixed(2)} ${scaleY(y, domain.yMin, domain.yMax).toFixed(2)}`)
    .join(" ");
}

function gridLines(domain: ReturnType<typeof computeDomain>) {
  return Array.from({ length: 5 }, (_, index) => {
    const value = domain.yMin + ((domain.yMax - domain.yMin) * index) / 4;
    return { value, y: scaleY(value, domain.yMin, domain.yMax) };
  });
}

function nearestAtX(series: InteractiveChartSpec["series"], x: number) {
  const values = series.map((item) => {
    const nearest = item.points.reduce((best, point) => (Math.abs(point[0] - x) < Math.abs(best[0] - x) ? point : best), item.points[0]);
    return { name: item.name, y: nearest[1], unit: item.unit, color: item.color };
  });
  return { x, values };
}

function formatNumber(value: number) {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
