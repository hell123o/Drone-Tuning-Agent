const DEFAULT_TAIL_LENGTH = 12000;

function tail(value, maxLength = DEFAULT_TAIL_LENGTH) {
  const text = String(value || "");
  return text.length > maxLength ? text.slice(-maxLength) : text;
}

function quoteArg(value) {
  const text = String(value);
  if (!text) return '""';
  if (!/[\s"]/u.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

export function formatCommandForDisplay(command, args = []) {
  return [command, ...args].map(quoteArg).join(" ");
}

export function buildFailureStatus({
  runId,
  step,
  startedAt,
  command,
  args = [],
  cwd,
  outputDir,
  projectRoot,
  runnerSource = "",
  code = null,
  signal = null,
  error = "",
  stdout = "",
  stderr = "",
}) {
  const commandLine = formatCommandForDisplay(command, args);
  const stdoutTail = tail(stdout);
  const stderrTail = tail(stderr);
  const details = [
    error ? `Error: ${error}` : "",
    code !== null && code !== undefined ? `Exit code: ${code}` : "",
    signal ? `Signal: ${signal}` : "",
    `Command: ${commandLine}`,
    `Working directory: ${cwd}`,
    `Project root: ${projectRoot}`,
    `Output directory: ${outputDir}`,
    stderrTail ? `\n--- stderr ---\n${stderrTail}` : "",
    stdoutTail ? `\n--- stdout ---\n${stdoutTail}` : "",
  ].filter(Boolean);

  return {
    runId,
    state: "error",
    step,
    progress: 100,
    startedAt,
    code,
    signal,
    error: details.join("\n"),
    stdout,
    stderr,
    stdoutTail,
    stderrTail,
    diagnostics: {
      command: commandLine,
      executable: command,
      args,
      commandLine,
      cwd,
      outputDir,
      projectRoot,
      runnerSource,
    },
  };
}
