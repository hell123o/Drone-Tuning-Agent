import assert from "node:assert/strict";
import test from "node:test";

import { buildChartOption } from "../src/features/charts/chart-config.mjs";

test("buildChartOption returns line chart for attitude", () => {
  const spec = {
    id: "attitude",
    title: "姿态角",
    xLabel: "Sample",
    yLabel: "Degree",
    series: [
      { name: "Roll", color: "#2563eb", unit: "°", points: [[0, 1], [1, 2]] },
    ],
  };
  const opt = buildChartOption(spec);
  assert.equal(opt.series[0].type, "line");
  assert.equal(opt.series[0].name, "Roll");
  assert.equal(opt.series[0].itemStyle.color, "#2563eb");
});

test("buildChartOption returns bar chart for fft", () => {
  const spec = {
    id: "fft",
    title: "振动频谱",
    xLabel: "Hz",
    yLabel: "Magnitude",
    series: [
      { name: "Accel FFT", color: "#2563eb", unit: "", points: [[0, 0], [10, 5]] },
    ],
  };
  const opt = buildChartOption(spec);
  assert.equal(opt.series[0].type, "bar");
});

test("buildChartOption maps thresholds to markLine", () => {
  const spec = {
    id: "vibration",
    title: "振动强度",
    series: [{ name: "Vibration", color: "#2563eb", unit: "m/s²", points: [[0, 1]] }],
    thresholds: [
      { value: 15, label: "注意", color: "#f59e0b" },
    ],
  };
  const opt = buildChartOption(spec);
  assert.ok(opt.series[0].markLine);
  assert.equal(opt.series[0].markLine.data[0].yAxis, 15);
});

test("buildChartOption uses dual yAxis for battery with V and A", () => {
  const spec = {
    id: "battery",
    title: "电池状态",
    series: [
      { name: "Voltage", color: "#2563eb", unit: "V", points: [[0, 12]] },
      { name: "Current", color: "#f59e0b", unit: "A", points: [[0, 5]] },
    ],
  };
  const opt = buildChartOption(spec);
  assert.equal(opt.yAxis.length, 2);
  assert.equal(opt.series[0].yAxisIndex, 0);
  assert.equal(opt.series[1].yAxisIndex, 1);
});
