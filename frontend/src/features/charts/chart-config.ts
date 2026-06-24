import type { EChartsOption } from "echarts";
import { buildChartOption as buildChartOptionJs } from "./chart-config.mjs";
import type { InteractiveChartSpec } from "./types";

export function buildChartOption(spec: InteractiveChartSpec): EChartsOption {
  return buildChartOptionJs(spec) as EChartsOption;
}
