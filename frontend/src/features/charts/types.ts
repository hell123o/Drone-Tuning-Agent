export type ChartPoint = [number, number];

export type InteractiveChartSeries = {
  name: string;
  color: string;
  unit?: string;
  points: ChartPoint[];
};

export type InteractiveChartThreshold = {
  value: number;
  label: string;
  color: string;
};

export type InteractiveChartSpec = {
  id: string;
  title: string;
  xLabel?: string;
  yLabel?: string;
  thresholds?: InteractiveChartThreshold[];
  series: InteractiveChartSeries[];
};
