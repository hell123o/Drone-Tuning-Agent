# LLM UI Charts Blue Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix truncated LLM reports, simplify the frontend for new users, add chart enlargement/interaction, and switch the visual system to blue.

**Architecture:** Backend keeps the existing CLI/API contract but adds continuation handling for length-truncated LLM responses and emits `charts.json` alongside PNGs. Frontend turns the single dense page into a guided diagnosis workspace, keeps advanced settings collapsed, and renders interactive SVG chart data when available with PNG fallback.

**Tech Stack:** Python standard `unittest`, OpenAI-compatible SDK, Next.js 16 App Router, React 19, Tailwind CSS, existing shadcn/base-ui components, no new dependencies.

## Global Constraints

- No new dependencies.
- Keep backend CLI and existing report/chart/download URLs backward-compatible.
- Preserve PNG chart generation for PDF/download fallback.
- Use blue as the primary color system.
- Verify with backend tests, frontend tests/lint/build, and browser smoke.

---

### Task 1: LLM Continuation

**Files:**
- Create: `backend/tests/test_llm_continuation.py`
- Modify: `backend/agent.py`

**Interfaces:**
- Produces: `DroneAgent._generate_report(...)` automatically continues when `finish_reason == "length"`.
- Produces: `DroneAgent._call_llm(...)` still returns an OpenAI-compatible response.

- [ ] **Step 1: Write failing unittest**
  - Simulate two LLM responses: first with `finish_reason="length"`, second with `finish_reason="stop"`.
  - Assert final report includes both fragments and calls the LLM twice.
- [ ] **Step 2: Run `python -m unittest backend.tests.test_llm_continuation -v` and observe failure**
- [ ] **Step 3: Implement continuation loop**
  - Raise default `LLM_MAX_TOKENS` to `8000`.
  - Add `LLM_CONTINUATION_MAX_ROUNDS`, default `2`.
  - Continue with a short prompt when finish reason is `length`.
- [ ] **Step 4: Re-run unittest and backend CLI help**

### Task 2: Chart Data Contract

**Files:**
- Create: `backend/tests/test_chart_data.py`
- Modify: `backend/tools/charts.py`
- Modify: `frontend/src/lib/server/diagnosis-runner.ts`
- Modify: `frontend/src/features/diagnosis/types.ts`
- Modify: `frontend/src/features/runs/types.ts`

**Interfaces:**
- Produces: `charts.json` in run output with `{ charts: InteractiveChartSpec[] }`.
- Produces: frontend result fields `chartDataUrl?: string`.

- [ ] **Step 1: Write Python test for `charts.json` generation from minimal parsed data**
- [ ] **Step 2: Run test and observe failure**
- [ ] **Step 3: Generate chart data JSON next to PNG charts**
- [ ] **Step 4: Expose `charts.json` in API responses and content type route**

### Task 3: Simplified Blue Frontend

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/features/diagnosis/app-header.tsx`
- Modify: `frontend/src/features/diagnosis/diagnosis-form.tsx`
- Modify: `frontend/src/features/diagnosis/result-tabs.tsx`

**Interfaces:**
- Produces: three-step guided input flow in one page.
- Produces: blue primary visual theme.

- [ ] **Step 1: Switch tokens from green to blue**
- [ ] **Step 2: Convert form into guided steps with advanced details collapsed**
- [ ] **Step 3: Keep existing form state and submit contract unchanged**

### Task 4: Interactive Charts

**Files:**
- Create: `frontend/src/features/charts/interactive-chart.tsx`
- Create: `frontend/src/features/charts/chart-lightbox.tsx`
- Modify: `frontend/src/features/diagnosis/charts-panel.tsx`
- Modify: `frontend/src/features/runs/run-charts-grid.tsx`
- Modify: `frontend/src/features/diagnosis/use-diagnosis-run.ts`

**Interfaces:**
- Consumes: `chartDataUrl?: string` and `InteractiveChartSpec[]`.
- Produces: SVG chart with hover values, selectable series, reset zoom, and enlarged view.
- Falls back to PNG when JSON is missing.

- [ ] **Step 1: Add chart data loading to diagnosis hook**
- [ ] **Step 2: Render SVG charts from JSON data**
- [ ] **Step 3: Add lightbox for PNG and SVG charts**
- [ ] **Step 4: Verify chart panel remains usable without `charts.json`**

### Task 5: Verification

**Files:**
- No production files.

- [ ] **Step 1: Run `python -m unittest discover backend/tests -v`**
- [ ] **Step 2: Run `python backend/main.py --help`**
- [ ] **Step 3: Run `npm run lint`, `npm test`, `npm run build` in `frontend`**
- [ ] **Step 4: Browser smoke `http://127.0.0.1:3210/` and `/latest`**
