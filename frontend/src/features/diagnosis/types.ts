export type Chart = {
  name: string;
  url: string;
};

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

export type ChartData = {
  version: number;
  charts: InteractiveChartSpec[];
};

export type DiagnoseResult = {
  runId: string;
  outputDir: string;
  stdout: string;
  stderr: string;
  reportUrl: string;
  pdfUrl?: string;
  paramsUrl: string;
  charts: Chart[];
  chartDataUrl?: string;
};

export type DiagnoseStatus = Partial<DiagnoseResult> & {
  runId: string;
  state: "uploading" | "running" | "done" | "error";
  step?: string;
  progress?: number;
  error?: string;
  code?: number | null;
  stdoutTail?: string;
  stderrTail?: string;
};

export type DiagnosisRunState = {
  logfile: string;
  setLogfile: (value: string) => void;
  paramsFile: string;
  setParamsFile: (value: string) => void;
  question: string;
  setQuestion: (value: string) => void;
  apiBase: string;
  setApiBase: (value: string) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  testTime: string;
  setTestTime: (value: string) => void;
  testLocation: string;
  setTestLocation: (value: string) => void;
  testProject: string;
  setTestProject: (value: string) => void;
  testOperator: string;
  setTestOperator: (value: string) => void;
  testAircraft: string;
  setTestAircraft: (value: string) => void;
  logUpload: File | null;
  setLogUpload: (file: File | null) => void;
  paramsUpload: File | null;
  setParamsUpload: (file: File | null) => void;
  loading: boolean;
  error: string;
  clientStatus: string;
  progress: number;
  activeRunId: string;
  result: DiagnoseResult | null;
  report: string;
  paramsPreview: string;
  chartData: ChartData | null;
  startDiagnose: () => Promise<void>;
};
