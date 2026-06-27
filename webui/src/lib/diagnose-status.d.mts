export function formatCommandForDisplay(command: string, args?: string[]): string;

export function buildFailureStatus(input: {
  runId: string;
  step: string;
  startedAt: string;
  command: string;
  args?: string[];
  cwd: string;
  outputDir: string;
  projectRoot: string;
  runnerSource?: string;
  code?: number | null;
  signal?: NodeJS.Signals | null;
  error?: string;
  stdout?: string;
  stderr?: string;
}): Record<string, unknown>;
