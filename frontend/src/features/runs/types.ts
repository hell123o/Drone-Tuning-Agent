export type RunChart = {
  name: string;
  url: string;
};

export type RunChartPoint = [number, number];

export type RunInteractiveChartSeries = {
  name: string;
  color: string;
  unit?: string;
  points: RunChartPoint[];
};

export type RunInteractiveChartThreshold = {
  value: number;
  label: string;
  color: string;
};

export type RunInteractiveChartSpec = {
  id: string;
  title: string;
  xLabel?: string;
  yLabel?: string;
  thresholds?: RunInteractiveChartThreshold[];
  series: RunInteractiveChartSeries[];
};

export type RunChartData = {
  version: number;
  charts: RunInteractiveChartSpec[];
};

export type RunArtifact = {
  runId: string;
  reportUrl: string;
  pdfUrl?: string;
  paramsUrl: string;
  charts?: RunChart[];
  chartDataUrl?: string;
  finishedAt?: string;
  metadata?: Record<string, string>;
};

export type RunStatus = Partial<RunArtifact> & {
  runId: string;
  state?: "uploading" | "running" | "done" | "error";
  step?: string;
  progress?: number;
  error?: string;
  stdoutTail?: string;
  stderrTail?: string;
  stdout?: string;
  stderr?: string;
  updatedAt?: string;
};
