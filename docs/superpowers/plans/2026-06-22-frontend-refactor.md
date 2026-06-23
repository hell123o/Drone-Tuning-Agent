# Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Next.js frontend into focused UI, client-state, and server-runner modules without changing the diagnosis workflow.

**Architecture:** Keep Next app routes as thin entry points. Move browser state transitions into a `useDiagnosisRun` hook, presentational UI into diagnosis feature components, and API orchestration into server-side helper modules. Use Node built-in tests for pure helper behavior and keep framework behavior covered by lint/build plus the existing demo end-to-end check.

**Tech Stack:** Next.js 16.2.9, React 19.2.4, TypeScript, Node built-in `node:test`, existing shadcn/ui components, existing Browser verification.

## Global Constraints

- Do not add new dependencies.
- Preserve existing diagnosis behavior, output paths, route URLs, and demo workflow.
- Keep frontend route files thin and focused.
- Follow `frontend/AGENTS.md`: do not change Next conventions without local docs; local `node_modules/next/dist/docs` is unavailable, so route changes must stay within existing conventions.
- Use tests before behavior-affecting refactor code where practical.
- Run `npm run lint`, `npm test`, `npm run build`, and browser/demo verification before completion.

---

### Task 1: Add Regression Tests for Extracted Pure Helpers

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tests/diagnosis-client-utils.test.mjs`
- Create: `frontend/tests/diagnosis-server-utils.test.mjs`

**Interfaces:**
- Consumes: no new production modules initially.
- Produces expectations for:
  - `frontend/src/features/diagnosis/client-utils.mjs`
  - `frontend/src/lib/server/diagnosis-utils.mjs`

- [ ] **Step 1: Add failing tests for client helper behavior**

Create `frontend/tests/diagnosis-client-utils.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRunError,
  clampProgress,
  fileSummary,
  initialTestTime,
} from "../src/features/diagnosis/client-utils.mjs";

test("clampProgress bounds progress values for progress bar width", () => {
  assert.equal(clampProgress(-5), 0);
  assert.equal(clampProgress(42.4), 42.4);
  assert.equal(clampProgress(150), 100);
});

test("fileSummary renders selected file name and size in MB", () => {
  assert.equal(fileSummary({ name: "flight.ulg", size: 2 * 1024 * 1024 }), "已选择：flight.ulg (2.00 MB)");
});

test("buildRunError joins primary error and output tails without blank noise", () => {
  assert.equal(
    buildRunError({ error: "failed", stderrTail: "stderr", stdoutTail: "stdout" }),
    "failed\nstderr\nstdout",
  );
});

test("initialTestTime produces a non-empty localized timestamp", () => {
  assert.match(initialTestTime(), /\d/);
});
```

- [ ] **Step 2: Add failing tests for server helper behavior**

Create `frontend/tests/diagnosis-server-utils.test.mjs`:

```js
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildPythonArgs,
  isBundledCli,
  normalizeLocalPath,
  safeFileName,
  safeRunId,
} from "../src/lib/server/diagnosis-utils.mjs";

test("safeRunId sanitizes unsafe file names and uses a stable timestamp", () => {
  assert.equal(safeRunId("D:/logs/a bad log.ulg", new Date("2026-06-22T15:32:14Z")), "20260622153214_a_bad_log.ulg");
});

test("safeFileName preserves Chinese characters and removes path separators", () => {
  assert.equal(safeFileName("../测试 log.ulg"), "测试_log.ulg");
});

test("normalizeLocalPath converts Windows paths on non-Windows hosts only", () => {
  assert.equal(normalizeLocalPath("D:\\logs\\flight.ulg", "linux"), "/mnt/d/logs/flight.ulg");
  assert.equal(normalizeLocalPath("D:\\logs\\flight.ulg", "win32"), "D:\\logs\\flight.ulg");
});

test("isBundledCli identifies packaged Windows CLI commands", () => {
  assert.equal(isBundledCli(path.join("runtime", "drone-agent-cli.exe")), true);
  assert.equal(isBundledCli("python"), false);
});

test("buildPythonArgs keeps bundled CLI args and script args distinct", () => {
  const common = {
    logfile: "log.ulg",
    outputDir: "out",
    paramsFile: "2.params",
    question: "check hover",
    hardwareFile: "x760.json",
    apiBase: "http://localhost:8310/v1",
    model: "local-model",
    metadataFile: "metadata.json",
  };
  assert.deepEqual(buildPythonArgs({ ...common, command: "drone-agent-cli.exe" }), [
    "log.ulg",
    "--output",
    "out",
    "-p",
    "2.params",
    "-q",
    "check hover",
    "--hardware",
    "x760.json",
    "--api-base",
    "http://localhost:8310/v1",
    "--model",
    "local-model",
    "--metadata",
    "metadata.json",
  ]);
  assert.deepEqual(buildPythonArgs({ ...common, command: "python" }).slice(0, 3), ["main.py", "log.ulg", "--output"]);
});
```

- [ ] **Step 3: Add npm test script**

Update `frontend/package.json` scripts:

```json
"test": "node --test tests/*.test.mjs"
```

- [ ] **Step 4: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because `client-utils.mjs` and `diagnosis-utils.mjs` do not exist yet.

---

### Task 2: Implement Pure Helper Modules

**Files:**
- Create: `frontend/src/features/diagnosis/client-utils.mjs`
- Create: `frontend/src/lib/server/diagnosis-utils.mjs`
- Modify: `frontend/src/lib/server/paths.ts`

**Interfaces:**
- Produces:
  - `initialTestTime(): string`
  - `clampProgress(value: number): number`
  - `fileSummary(file?: {name:string,size:number}|null): string`
  - `buildRunError(status: { error?: string; step?: string; stderrTail?: string; stdoutTail?: string }): string`
  - `safeRunId(logfile: string, now?: Date): string`
  - `safeFileName(name: string): string`
  - `normalizeLocalPath(input?: string, platform?: NodeJS.Platform | string): string`
  - `isBundledCli(command: string): boolean`
  - `buildPythonArgs(input): string[]`

- [ ] **Step 1: Implement client utilities**

Add `frontend/src/features/diagnosis/client-utils.mjs`:

```js
export function initialTestTime() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

export function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function fileSummary(file) {
  if (!file) return "";
  return `已选择：${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
}

export function buildRunError(status) {
  return [
    status.error || status.step || "诊断失败",
    status.stderrTail || "",
    status.stdoutTail || "",
  ].filter(Boolean).join("\n").trim();
}
```

- [ ] **Step 2: Implement server utilities**

Add `frontend/src/lib/server/diagnosis-utils.mjs`:

```js
import path from "node:path";

export function safeRunId(logfile, now = new Date()) {
  const base = path.basename(logfile || "flight-log").replace(/[^a-zA-Z0-9_.-]+/g, "_");
  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${stamp}_${base}`;
}

export function safeFileName(name) {
  return path.basename(name || "input").replace(/[^a-zA-Z0-9_.\-\u4e00-\u9fa5]+/g, "_");
}

export function normalizeLocalPath(input, platform = process.platform) {
  const value = input?.trim();
  if (!value) return "";
  if (platform === "win32") return value;
  const match = value.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (!match) return value;
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, "/");
  return `/mnt/${drive}/${rest}`;
}

export function isBundledCli(command) {
  return path.basename(command).toLowerCase() === "drone-agent-cli.exe";
}

export function buildPythonArgs({
  command,
  logfile,
  outputDir,
  paramsFile,
  question,
  hardwareFile,
  apiBase,
  model,
  metadataFile,
}) {
  const args = isBundledCli(command)
    ? [logfile, "--output", outputDir]
    : ["main.py", logfile, "--output", outputDir];
  if (paramsFile) args.push("-p", paramsFile);
  if (question?.trim()) args.push("-q", question.trim());
  if (hardwareFile) args.push("--hardware", hardwareFile);
  if (apiBase?.trim()) args.push("--api-base", apiBase.trim());
  if (model?.trim()) args.push("--model", model.trim());
  if (metadataFile) args.push("--metadata", metadataFile);
  return args;
}
```

- [ ] **Step 3: Run tests and verify GREEN**

Run: `npm test`

Expected: PASS.

---

### Task 3: Refactor Diagnosis Page into Feature Hook and Components

**Files:**
- Create: `frontend/src/features/diagnosis/types.ts`
- Create: `frontend/src/features/diagnosis/use-diagnosis-run.ts`
- Create: `frontend/src/features/diagnosis/app-header.tsx`
- Create: `frontend/src/features/diagnosis/diagnosis-form.tsx`
- Create: `frontend/src/features/diagnosis/result-tabs.tsx`
- Create: `frontend/src/features/diagnosis/file-picker.tsx`
- Create: `frontend/src/features/diagnosis/empty-state.tsx`
- Create: `frontend/src/features/diagnosis/progress-status.tsx`
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- `useDiagnosisRun()` returns state fields and setters needed by `DiagnosisForm` and `ResultTabs`.
- `DiagnosisForm` consumes the hook object and renders all user inputs.
- `ResultTabs` consumes report/result/error state and renders report/charts/params/logs.
- `page.tsx` only composes header, form, and results.

- [ ] **Step 1: Move shared types**

Create `types.ts` with `Chart`, `DiagnoseResult`, `DiagnoseStatus`, and `DiagnosisRunState` types matching current behavior.

- [ ] **Step 2: Extract hook**

Move current `useState`, `loadResult`, `pollDiagnosis`, latest-run polling, and `startDiagnose` into `use-diagnosis-run.ts`.

- [ ] **Step 3: Extract presentational components**

Move the header, form, file picker, progress block, result tabs, and empty state into focused component files.

- [ ] **Step 4: Slim page**

Replace `page.tsx` body with:

```tsx
"use client";

import { AppHeader } from "@/features/diagnosis/app-header";
import { DiagnosisForm } from "@/features/diagnosis/diagnosis-form";
import { ResultTabs } from "@/features/diagnosis/result-tabs";
import { useDiagnosisRun } from "@/features/diagnosis/use-diagnosis-run";

export default function Home() {
  const diagnosis = useDiagnosisRun();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6 lg:px-8">
        <AppHeader loading={diagnosis.loading} hasResult={Boolean(diagnosis.result)} />
        <div className="grid gap-6 lg:grid-cols-[460px_1fr]">
          <DiagnosisForm diagnosis={diagnosis} />
          <ResultTabs diagnosis={diagnosis} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Run verification**

Run: `npm run lint && npm test && npm run build`

Expected: all commands exit 0.

---

### Task 4: Refactor Diagnose API Route into Server Modules

**Files:**
- Create: `frontend/src/lib/server/diagnosis-input.ts`
- Create: `frontend/src/lib/server/diagnosis-runner.ts`
- Modify: `frontend/src/app/api/diagnose/route.ts`

**Interfaces:**
- `parseDiagnoseInput(request: NextRequest): Promise<DiagnoseInput>`
- `prepareDiagnosisRun(input: DiagnoseInput): Promise<PreparedDiagnosisRun | NextResponse>`
- `startDiagnosisJob(prepared: PreparedDiagnosisRun): void`
- `route.ts` handles request, prepares run, starts job, and returns `202` or redirect.

- [ ] **Step 1: Move input parsing**

Move `DiagnoseInput`, metadata fields, `readMetadataFromForm`, and `parseInput` into `diagnosis-input.ts`.

- [ ] **Step 2: Move process/status orchestration**

Move `pickPython`, `backendCwd`, `statusPath`, `writeStatus`, `buildDoneResponse`, and `startDiagnosisJob` into `diagnosis-runner.ts`.

- [ ] **Step 3: Keep route thin**

Keep `POST()` responsible for:
1. `parseDiagnoseInput(request)`
2. validating log input
3. creating run directory and upload files
4. building args via `buildPythonArgs`
5. calling `startDiagnosisJob`
6. returning redirect or JSON `202`

- [ ] **Step 4: Run verification**

Run: `npm run lint && npm test && npm run build`

Expected: all commands exit 0.

---

### Task 5: Final End-to-End Verification

**Files:**
- No production files unless fixing verification failures.

**Interfaces:**
- Uses existing demo files:
  - `docs/log_92_2026-6-22-16-57-16.ulg`
  - `docs/2.params`

- [ ] **Step 1: Run frontend checks**

Run:

```bash
cd frontend
npm run lint
npm test
npm run build
```

Expected: all exit 0.

- [ ] **Step 2: Run backend sanity check**

Run:

```bash
cd backend
python main.py --help
```

Expected: usage output and exit 0.

- [ ] **Step 3: Run API demo**

With dev server on `http://127.0.0.1:3210`, POST the demo paths to `/api/diagnose`, poll `/api/status/<runId>`, and confirm state `done`.

- [ ] **Step 4: Browser smoke check**

Open `http://127.0.0.1:3210` and confirm the page title is `Drone Tuning Agent` and the diagnosis form plus tabs render.

- [ ] **Step 5: Report residual risk**

Report any remaining warnings, especially the known non-blocking Turbopack NFT tracing warning if it persists.
