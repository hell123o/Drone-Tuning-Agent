export function buildChartOption(spec) {
  const isFft = spec.id === "fft";
  const seriesType = isFft ? "bar" : "line";

  const hasVoltage = spec.series.some((s) => s.unit === "V");
  const hasCurrent = spec.series.some((s) => s.unit === "A");
  const dualAxis = hasVoltage && hasCurrent;

  const yAxis = dualAxis
    ? [
        { type: "value", name: "V", position: "left" },
        { type: "value", name: "A", position: "right" },
      ]
    : [{ type: "value", name: spec.yLabel ?? "Value" }];

  const series = spec.series.map((s) => {
    const yAxisIndex = dualAxis ? (s.unit === "A" ? 1 : 0) : 0;
    const data = s.points.map(([x, y]) => [x, y]);
    const result = {
      name: s.name,
      type: seriesType,
      data,
      yAxisIndex,
      itemStyle: { color: s.color },
      lineStyle: seriesType === "line" ? { color: s.color, width: 1.5 } : undefined,
      smooth: false,
    };
    if (spec.thresholds && spec.thresholds.length) {
      result.markLine = {
        symbol: "none",
        data: spec.thresholds.map((t) => ({
          yAxis: t.value,
          lineStyle: { color: t.color, type: "dashed" },
          label: { formatter: t.label },
        })),
      };
    }
    return result;
  });

  return {
    title: { text: spec.title, left: "center", textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: "axis" },
    legend: { top: 24 },
    grid: { left: 60, right: dualAxis ? 60 : 24, top: 56, bottom: 60 },
    xAxis: { type: "value", name: spec.xLabel ?? "Sample" },
    yAxis,
    dataZoom: [
      { type: "inside" },
      { type: "slider", bottom: 8 },
    ],
    series,
  };
}
