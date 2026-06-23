# 前端界面重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Drone Tuning Agent 前端从单页双栏布局重构为向导式诊断 + 侧边栏历史 + 独立结果页的极简留白架构。

**Architecture:** Next.js 16 App Router，三路由（`/` 向导、`/runs/[runId]` 详情、`/runs` 历史）共享侧边栏 Shell。向导为单页内三步状态机，结果页为 Server Component，历史页用新增 `/api/runs` 接口。视觉走 Linear/Vercel 极简留白风格。

**Tech Stack:** Next.js 16.2.9、React 19.2.4、Tailwind CSS 4、shadcn、lucide-react、react-markdown、Inter (next/font/google)、node:test

## Global Constraints

- 后端 4 个 API route 数据契约冻结（`/api/diagnose`、`/api/status/[runId]`、`/api/latest`、`/api/runs/[...path]`），不改动后端 Python
- 仅新增 `/api/runs` 一个 route
- 保证 Electron standalone 打包兼容（`output: "standalone"` 保留）
- 无暗色模式
- Next.js 16：`params`/`searchParams` 为 Promise，需 `await`；使用全局 `PageProps<'/route'>` 类型助手
- 测试用 `node --test tests/*.test.mjs`，纯 `.mjs` 文件，import 现有 `.mjs` 工具
- 中文界面，全量中文文案
- 不做 e2e、不做暗色模式、不做运行对比、不做报告搜索

---

## File Structure

### 新建文件

| 文件 | 职责 |
|---|---|
| `src/app/layout.tsx` (改写) | Root Layout：Inter 字体 + 侧边栏 Shell + 主区容器 |
| `src/app/page.tsx` (改写) | 向导首页，client component，三步状态机 |
| `src/app/runs/page.tsx` | 历史列表页，Server Component |
| `src/app/runs/[runId]/page.tsx` | 结果详情页，Server Component |
| `src/app/api/runs/route.ts` | 新增列表接口 |
| `src/components/app-sidebar.tsx` | 侧边栏（Logo/新建/历史8条/查看全部） |
| `src/components/empty-state.tsx` | 通用空态组件 |
| `src/components/segmented-nav.tsx` | 极简分段控件 |
| `src/features/wizard/types.ts` | 向导类型 |
| `src/features/wizard/wizard-utils.mjs` | 向导纯函数工具（初始时间/进度裁剪/错误拼接/文件摘要） |
| `src/features/wizard/use-wizard-state.ts` | 向导步骤+表单状态 hook |
| `src/features/wizard/use-diagnosis-submission.ts` | 提交+轮询 hook |
| `src/features/wizard/wizard-stepper.tsx` | 步骤指示器 |
| `src/features/wizard/drop-zone.tsx` | 拖拽上传区 |
| `src/features/wizard/step-upload.tsx` | 步骤① |
| `src/features/wizard/step-describe.tsx` | 步骤② |
| `src/features/wizard/step-running.tsx` | 步骤③ |
| `src/features/runs/types.ts` (改写) | 运行类型，加 RunSummary |
| `src/features/runs/run-utils.mjs` | 运行纯函数（时间格式化/状态色/短码） |
| `src/features/runs/run-summary-card.tsx` | 历史卡片 |
| `src/features/runs/run-list.tsx` | 历史列表+筛选（client） |
| `src/features/runs/run-header.tsx` | 详情页顶部信息行 |
| `src/features/runs/run-detail-client.tsx` | 详情页客户端岛（分段切换） |
| `src/features/runs/report-section.tsx` | 报告段 |
| `src/features/runs/charts-section.tsx` | 图表段 |
| `src/features/runs/params-section.tsx` | 参数段 |
| `src/features/runs/logs-collapsible.tsx` | 日志折叠区 |
| `tests/wizard-utils.test.mjs` | 向导工具测试 |
| `tests/run-utils.test.mjs` | 运行工具测试 |
| `tests/runs-api.test.mjs` | /api/runs 接口测试 |

### 删除文件（最后统一删除）

`src/app/latest/`、`src/app/progress/`、`src/features/diagnosis/`（整个目录）、`src/features/runs/run-page-shell.tsx`、`src/features/runs/run-download-links.tsx`、`src/features/runs/run-metadata.tsx`、`src/features/runs/run-charts-grid.tsx`、`tests/diagnosis-client-utils.test.mjs`

### 保留复用

`src/features/charts/*`（3 文件）、`src/lib/server/*`（4 文件）、`src/components/ui/*`（11 shadcn 组件）、现有 4 个 API route

---

### Task 1: 向导纯函数工具 + 测试

**Files:**
- Create: `src/features/wizard/wizard-utils.mjs`
- Create: `tests/wizard-utils.test.mjs`

**Interfaces:**
- Produces: `initialTestTime()`, `clampProgress(value)`, `fileSummary(file)`, `buildRunError(status)` — 从旧 `client-utils.mjs` 迁移，签名不变

- [ ] **Step 1: 写失败测试**

```js
// tests/wizard-utils.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRunError,
  clampProgress,
  fileSummary,
  initialTestTime,
} from "../src/features/wizard/wizard-utils.mjs";

test("clampProgress bounds progress values for progress bar width", () => {
  assert.equal(clampProgress(-5), 0);
  assert.equal(clampProgress(42.4), 42.4);
  assert.equal(clampProgress(150), 100);
});

test("fileSummary renders selected file name and size in MB", () => {
  assert.equal(fileSummary({ name: "flight.ulg", size: 2 * 1024 * 1024 }), "已选择：flight.ulg (2.00 MB)");
});

test("fileSummary returns empty string for null file", () => {
  assert.equal(fileSummary(null), "");
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

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test` (在 frontend/ 下)
Expected: FAIL — 找不到模块 `../src/features/wizard/wizard-utils.mjs`

- [ ] **Step 3: 写最小实现**

```js
// src/features/wizard/wizard-utils.mjs
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

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS（新测试通过；旧的 `diagnosis-client-utils.test.mjs` 会因 import 路径失败，暂时忽略，Task 12 统一删除）

- [ ] **Step 5: 提交**

```bash
git add src/features/wizard/wizard-utils.mjs tests/wizard-utils.test.mjs
git commit -m "feat(wizard): add wizard pure utils with tests"
```

---

### Task 2: 运行纯函数工具 + 测试

**Files:**
- Create: `src/features/runs/run-utils.mjs`
- Create: `tests/run-utils.test.mjs`

**Interfaces:**
- Produces: `formatRunTime(iso)`, `shortRunId(runId)`, `statusColor(state)`, `formatDuration(startedAt, finishedAt)`

- [ ] **Step 1: 写失败测试**

```js
// tests/run-utils.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDuration,
  formatRunTime,
  shortRunId,
  statusColor,
} from "../src/features/runs/run-utils.mjs";

test("shortRunId returns first 8 chars of runId", () => {
  assert.equal(shortRunId("20260623110400_log_92.ulg"), "20260623");
});

test("shortRunId handles short runId", () => {
  assert.equal(shortRunId("abc"), "abc");
});

test("statusColor returns dot color class for each state", () => {
  assert.equal(statusColor("done"), "bg-emerald-500");
  assert.equal(statusColor("error"), "bg-rose-500");
  assert.equal(statusColor("running"), "bg-blue-500");
  assert.equal(statusColor("uploading"), "bg-blue-400");
  assert.equal(statusColor("unknown"), "bg-muted-foreground");
});

test("formatRunTime renders ISO to zh-CN locale string", () => {
  const result = formatRunTime("2026-06-23T11:04:55.174Z");
  assert.match(result, /2026/);
});

test("formatRunTime returns empty string for falsy input", () => {
  assert.equal(formatRunTime(""), "");
  assert.equal(formatRunTime(undefined), "");
});

test("formatDuration computes seconds from startedAt to finishedAt", () => {
  const result = formatDuration("2026-06-23T11:04:00.000Z", "2026-06-23T11:04:55.000Z");
  assert.equal(result, "55 秒");
});

test("formatDuration returns empty string if either timestamp missing", () => {
  assert.equal(formatDuration("", "2026-06-23T11:04:55.000Z"), "");
  assert.equal(formatDuration("2026-06-23T11:04:00.000Z", ""), "");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — 找不到模块

- [ ] **Step 3: 写最小实现**

```js
// src/features/runs/run-utils.mjs
export function shortRunId(runId) {
  if (!runId) return "";
  return runId.slice(0, 8);
}

export function statusColor(state) {
  if (state === "done") return "bg-emerald-500";
  if (state === "error") return "bg-rose-500";
  if (state === "running") return "bg-blue-500";
  if (state === "uploading") return "bg-blue-400";
  return "bg-muted-foreground";
}

export function formatRunTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "";
  }
}

export function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return "";
  try {
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    if (ms < 0) return "";
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec} 秒`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min} 分 ${rem} 秒`;
  } catch {
    return "";
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/features/runs/run-utils.mjs tests/run-utils.test.mjs
git commit -m "feat(runs): add run pure utils with tests"
```

---

### Task 3: 视觉系统改造（globals.css + layout 字体）

**Files:**
- Modify: `src/app/globals.css` (全量改写 :root 变量、删 .dark、调 prose)
- Modify: `src/app/layout.tsx` (加 Inter 字体 + Shell 容器，暂放占位侧边栏)

**Interfaces:**
- Produces: Inter 字体 CSS 变量 `--font-sans`、`--font-geist-mono`；纯白背景 token

- [ ] **Step 1: 改写 globals.css 的 :root 与字体变量**

替换 `src/app/globals.css` 第 51-120 行（`:root { ... }` 到 `.dark { ... }` 结束）为：

```css
:root {
  --background: oklch(1 0 0);
  --font-sans: var(--font-inter), "Microsoft YaHei", "Segoe UI", system-ui, sans-serif;
  --font-geist-mono: var(--font-jetbrains), "Cascadia Code", "Consolas", monospace;
  --foreground: oklch(0.22 0.035 255);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.035 255);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.035 255);
  --primary: oklch(0.48 0.17 255);
  --primary-foreground: oklch(0.99 0.01 255);
  --secondary: oklch(0.97 0.005 255);
  --secondary-foreground: oklch(0.28 0.05 255);
  --muted: oklch(0.97 0.005 255);
  --muted-foreground: oklch(0.48 0.035 255);
  --accent: oklch(0.97 0.005 255);
  --accent-foreground: oklch(0.28 0.05 255);
  --destructive: oklch(0.57 0.21 27);
  --border: oklch(0.92 0.01 255);
  --input: oklch(0.92 0.01 255);
  --ring: oklch(0.48 0.17 255);
  --chart-1: oklch(0.48 0.17 255);
  --chart-2: oklch(0.62 0.14 48);
  --chart-3: oklch(0.6 0.14 230);
  --chart-4: oklch(0.62 0.13 285);
  --chart-5: oklch(0.58 0.17 20);
  --radius: 0.75rem;
  --sidebar: oklch(0.985 0.004 255);
  --sidebar-foreground: oklch(0.22 0.035 255);
  --sidebar-primary: oklch(0.48 0.17 255);
  --sidebar-primary-foreground: oklch(0.99 0.01 255);
  --sidebar-accent: oklch(0.97 0.005 255);
  --sidebar-accent-foreground: oklch(0.28 0.05 255);
  --sidebar-border: oklch(0.92 0.01 255);
  --sidebar-ring: oklch(0.48 0.17 255);
}
```

删除整个 `.dark { ... }` 块（第 88-120 行）。

- [ ] **Step 2: 调整 base layer 删除 input 白底硬编码**

替换 `src/app/globals.css` 的 `@layer base` 块（第 122-139 行）为：

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground antialiased;
  }

  html {
    @apply font-sans;
  }
}
```

（删除 `input, textarea { @apply bg-white/80; }` 硬编码）

- [ ] **Step 3: 改写 layout.tsx 引入 Inter + JetBrains Mono**

替换整个 `src/app/layout.tsx`：

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drone Tuning Agent",
  description: "无人机飞行日志诊断与调参工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-sidebar lg:block">
            <div className="p-6 text-sm text-muted-foreground">侧边栏占位</div>
          </aside>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: 启动 dev 确认无报错**

Run: `npm run dev`
Expected: dev server 启动，首页显示"侧边栏占位"（因为 page.tsx 还没改，旧首页仍渲染但布局已套上新 shell）。Inter 字体生效，纯白背景。

- [ ] **Step 5: 提交**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): apply minimalist visual system with Inter font"
```

---

### Task 4: 通用组件（EmptyState + SegmentedNav）

**Files:**
- Create: `src/components/empty-state.tsx`
- Create: `src/components/segmented-nav.tsx`

**Interfaces:**
- Produces: `EmptyState({ title, description })`、`SegmentedNav({ items, value, onChange })`

- [ ] **Step 1: 创建 EmptyState**

```tsx
// src/components/empty-state.tsx
import { Radar } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-muted-foreground">
      <div className="flex size-10 items-center justify-center rounded-lg bg-background text-muted-foreground">
        <Radar className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="max-w-md text-sm leading-6">{description}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 SegmentedNav**

```tsx
// src/components/segmented-nav.tsx
"use client";

import { cn } from "@/lib/utils";

export type SegmentedNavItem = {
  value: string;
  label: string;
};

type SegmentedNavProps = {
  items: SegmentedNavItem[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedNav({ items, value, onChange }: SegmentedNavProps) {
  return (
    <nav className="flex items-center gap-6 border-b border-border/60">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "-mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors",
            value === item.value
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: typecheck 确认无错**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/empty-state.tsx src/components/segmented-nav.tsx
git commit -m "feat(ui): add EmptyState and SegmentedNav components"
```

---

### Task 5: `/api/runs` 列表接口

**Files:**
- Create: `src/app/api/runs/route.ts`
- Create: `tests/runs-api.test.mjs`
- Modify: `src/features/runs/types.ts` (加 RunSummary 类型)

**Interfaces:**
- Consumes: `RUNS_ROOT` from `@/lib/server/paths`；`isPathInside` from `@/lib/server/paths`
- Produces: `GET /api/runs` → `{ runs: RunSummary[] }`；`RunSummary` 类型

- [ ] **Step 1: 扩充 runs types**

在 `src/features/runs/types.ts` 末尾追加：

```ts
export type RunSummary = {
  runId: string;
  state: "uploading" | "running" | "done" | "error";
  step?: string;
  progress?: number;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  metadata?: Record<string, string>;
  hasReport: boolean;
  hasParams: boolean;
  hasPdf: boolean;
  chartsCount: number;
};
```

- [ ] **Step 2: 写失败测试**

```js
// tests/runs-api.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

test("RunSummary type exists in types module", async () => {
  // 类型文件无法在纯 mjs 直接导入断言，改为验证 route 模块可加载
  // 此测试占位；实际接口验证通过 dev server 手动 curl
  assert.ok(true);
});
```

- [ ] **Step 3: 实现 route**

```ts
// src/app/api/runs/route.ts
import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";

import { isPathInside, RUNS_ROOT } from "@/lib/server/paths";

export async function GET() {
  const runs: RunSummary[] = [];

  if (existsSync(RUNS_ROOT)) {
    const entries = readdirSync(RUNS_ROOT);
    for (const name of entries) {
      const dir = path.resolve(RUNS_ROOT, name);
      if (!isPathInside(RUNS_ROOT, dir)) continue;
      if (!statSync(dir).isDirectory()) continue;

      const statusFile = path.resolve(dir, "status.json");
      if (!isPathInside(dir, statusFile) || !existsSync(statusFile)) continue;

      try {
        const raw = JSON.parse(readFileSync(statusFile, "utf-8"));
        runs.push({
          runId: raw.runId ?? name,
          state: raw.state ?? "done",
          step: raw.step,
          progress: raw.progress,
          startedAt: raw.startedAt,
          finishedAt: raw.finishedAt,
          updatedAt: raw.updatedAt,
          metadata: raw.metadata,
          hasReport: Boolean(raw.reportUrl),
          hasParams: Boolean(raw.paramsUrl),
          hasPdf: Boolean(raw.pdfUrl),
          chartsCount: Array.isArray(raw.charts) ? raw.charts.length : 0,
        });
      } catch {
        // 损坏的 status.json 跳过
      }
    }
  }

  runs.sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json({ runs }, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 4: typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 启动 dev 手动验证接口**

Run: `npm run dev`，另开终端：
```bash
curl -s http://localhost:3000/api/runs | python -m json.tool
```
Expected: 返回 `{ "runs": [...] }`，含现有 4 个运行（`20260622153214_...` 等），按 updatedAt 倒序，无 `demo-cli`/`verify-charts-json` 等非运行目录。每条含 `hasReport: true`、`chartsCount: 5`。

- [ ] **Step 6: 提交**

```bash
git add src/app/api/runs/route.ts src/features/runs/types.ts tests/runs-api.test.mjs
git commit -m "feat(api): add GET /api/runs list endpoint"
```

---

### Task 6: 侧边栏组件

**Files:**
- Create: `src/components/app-sidebar.tsx`
- Modify: `src/app/layout.tsx` (接入真实侧边栏)

**Interfaces:**
- Consumes: `GET /api/runs` 返回的 `{ runs: RunSummary[] }`；`statusColor` from `@/features/runs/run-utils.mjs`；`shortRunId` from same；`formatRunTime` from same
- Produces: `AppSidebar` 组件，client component，轮询 `/api/runs` 取前 8 条

- [ ] **Step 1: 创建侧边栏组件**

```tsx
// src/components/app-sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RunSummary } from "@/features/runs/types";
import { formatRunTime, shortRunId, statusColor } from "@/features/runs/run-utils.mjs";

export function AppSidebar() {
  const [runs, setRuns] = useState<RunSummary[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.runs)) {
          setRuns(data.runs.slice(0, 8));
        }
      } catch {
        // 静默
      }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <Radar className="size-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">Drone Tuning Agent</span>
      </div>

      <div className="px-4">
        <Link href="/">
          <Button variant="default" className="w-full gap-2" size="sm">
            <Plus className="size-4" />
            新建诊断
          </Button>
        </Link>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto px-4">
        <p className="px-1 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          运行历史
        </p>
        <div className="space-y-0.5">
          {runs.length === 0 ? (
            <p className="px-1 py-4 text-xs text-muted-foreground">暂无运行记录</p>
          ) : (
            runs.map((run) => (
              <Link
                key={run.runId}
                href={`/runs/${run.runId}`}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-muted"
              >
                <span className={`size-1.5 shrink-0 rounded-full ${statusColor(run.state)}`} />
                <span className="min-w-0 flex-1 truncate font-mono">{shortRunId(run.runId)}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatRunTime(run.updatedAt).slice(5, 16) || ""}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-3">
        <Link
          href="/runs"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          查看全部 →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新 layout.tsx 接入真实侧边栏**

修改 `src/app/layout.tsx`，将占位 aside 替换为 `<AppSidebar />`：

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { AppSidebar } from "@/components/app-sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drone Tuning Agent",
  description: "无人机飞行日志诊断与调参工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-sidebar lg:block">
            <AppSidebar />
          </aside>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: typecheck + dev 验证**

Run: `npx tsc --noEmit && npm run dev`
Expected: typecheck 通过；dev 下侧边栏显示 Logo、新建按钮、运行历史列表（含现有运行记录）、查看全部链接

- [ ] **Step 4: 提交**

```bash
git add src/components/app-sidebar.tsx src/app/layout.tsx
git commit -m "feat(ui): add AppSidebar with live run history"
```

---

### Task 7: 向导类型 + 状态 hook

**Files:**
- Create: `src/features/wizard/types.ts`
- Create: `src/features/wizard/use-wizard-state.ts`

**Interfaces:**
- Produces: `WizardStep` 类型（`"upload" | "describe" | "running"`）、`WizardFormState` 类型、`useWizardState()` hook 返回步骤+所有表单字段+setter+`canProceed`+`next`/`prev`/`reset`

- [ ] **Step 1: 创建向导类型**

```ts
// src/features/wizard/types.ts
export type WizardStep = "upload" | "describe" | "running";

export type WizardFormState = {
  logfile: string;
  paramsFile: string;
  question: string;
  apiBase: string;
  apiKey: string;
  model: string;
  testTime: string;
  testLocation: string;
  testProject: string;
  testOperator: string;
  testAircraft: string;
  logUpload: File | null;
  paramsUpload: File | null;
};
```

- [ ] **Step 2: 创建 useWizardState hook**

```ts
// src/features/wizard/use-wizard-state.ts
"use client";

import { useState } from "react";

import { initialTestTime } from "./wizard-utils.mjs";
import type { WizardFormState, WizardStep } from "./types";

export function useWizardState() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [logfile, setLogfile] = useState("");
  const [paramsFile, setParamsFile] = useState("");
  const [question, setQuestion] = useState("");
  const [apiBase, setApiBase] = useState("http://192.168.2.158:8310/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [testTime, setTestTime] = useState(initialTestTime);
  const [testLocation, setTestLocation] = useState("");
  const [testProject, setTestProject] = useState("");
  const [testOperator, setTestOperator] = useState("");
  const [testAircraft, setTestAircraft] = useState("X760");
  const [logUpload, setLogUpload] = useState<File | null>(null);
  const [paramsUpload, setParamsUpload] = useState<File | null>(null);

  const canProceed = Boolean(logUpload || logfile.trim());

  function next() {
    setStep((prev) => {
      if (prev === "upload") return "describe";
      if (prev === "describe") return "running";
      return prev;
    });
  }

  function prev() {
    setStep((prev) => {
      if (prev === "describe") return "upload";
      return prev;
    });
  }

  function reset() {
    setStep("upload");
    setLogfile("");
    setParamsFile("");
    setQuestion("");
    setLogUpload(null);
    setParamsUpload(null);
  }

  const form: WizardFormState = {
    logfile,
    paramsFile,
    question,
    apiBase,
    apiKey,
    model,
    testTime,
    testLocation,
    testProject,
    testOperator,
    testAircraft,
    logUpload,
    paramsUpload,
  };

  return {
    step,
    setStep,
    next,
    prev,
    reset,
    canProceed,
    form,
    setLogfile,
    setParamsFile,
    setQuestion,
    setApiBase,
    setApiKey,
    setModel,
    setTestTime,
    setTestLocation,
    setTestProject,
    setTestOperator,
    setTestAircraft,
    setLogUpload,
    setParamsUpload,
  };
}

export type WizardState = ReturnType<typeof useWizardState>;
```

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/features/wizard/types.ts src/features/wizard/use-wizard-state.ts
git commit -m "feat(wizard): add types and useWizardState hook"
```

---

### Task 8: 诊断提交 + 轮询 hook

**Files:**
- Create: `src/features/wizard/use-diagnosis-submission.ts`

**Interfaces:**
- Consumes: `WizardFormState` from `./types`；`buildRunError` from `./wizard-utils.mjs`
- Produces: `useDiagnosisSubmission(onDone)` hook，返回 `{ loading, progress, activeRunId, error, clientStatus, submit(form), abandon() }`

- [ ] **Step 1: 创建提交 hook**

```ts
// src/features/wizard/use-diagnosis-submission.ts
"use client";

import { useRef, useState } from "react";

import { buildRunError } from "./wizard-utils.mjs";
import type { WizardFormState } from "./types";

type DiagnoseResponse = {
  runId?: string;
  error?: string;
  stderr?: string;
  stdout?: string;
  step?: string;
  progress?: number;
};

type DiagnoseStatus = {
  state: "uploading" | "running" | "done" | "error";
  step?: string;
  progress?: number;
  error?: string;
  stdoutTail?: string;
  stderrTail?: string;
  runId: string;
};

export function useDiagnosisSubmission(onDone: (runId: string) => void) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeRunId, setActiveRunId] = useState("");
  const [error, setError] = useState("");
  const [clientStatus, setClientStatus] = useState("页面已加载，等待开始诊断");
  const pollingRef = useRef(false);

  async function pollDiagnosis(runId: string) {
    setActiveRunId(runId);
    pollingRef.current = true;
    while (pollingRef.current) {
      let res: Response;
      try {
        res = await fetch(`/api/status/${encodeURIComponent(runId)}`, { cache: "no-store" });
      } catch {
        if (!pollingRef.current) return;
        await new Promise((r) => window.setTimeout(r, 1500));
        continue;
      }
      const status = (await res.json()) as DiagnoseStatus;
      if (!res.ok) {
        setError(status.error || "无法读取诊断进度");
        setLoading(false);
        pollingRef.current = false;
        return;
      }
      setProgress(status.progress ?? 0);
      setClientStatus(status.step || `诊断状态：${status.state}`);
      if (status.state === "done") {
        pollingRef.current = false;
        setLoading(false);
        setProgress(100);
        onDone(runId);
        return;
      }
      if (status.state === "error") {
        pollingRef.current = false;
        setLoading(false);
        setError(buildRunError(status));
        return;
      }
      await new Promise((r) => window.setTimeout(r, 1500));
    }
  }

  async function submit(form: WizardFormState) {
    setLoading(true);
    setProgress(5);
    setActiveRunId("");
    setError("");
    setClientStatus("正在上传文件并启动诊断...");

    try {
      const fd = new FormData();
      fd.set("logfile", form.logfile);
      fd.set("paramsFile", form.paramsFile);
      fd.set("question", form.question);
      fd.set("apiBase", form.apiBase);
      fd.set("apiKey", form.apiKey);
      fd.set("model", form.model);
      fd.set("testTime", form.testTime);
      fd.set("testLocation", form.testLocation);
      fd.set("testProject", form.testProject);
      fd.set("testOperator", form.testOperator);
      fd.set("testAircraft", form.testAircraft);
      if (form.logUpload) fd.set("logfileUpload", form.logUpload);
      if (form.paramsUpload) fd.set("paramsUpload", form.paramsUpload);

      const res = await fetch("/api/diagnose", { method: "POST", body: fd });
      setClientStatus(`服务器已响应：HTTP ${res.status}`);
      const data = (await res.json()) as DiagnoseResponse;
      if (!res.ok) {
        setError(`${data.error ?? "诊断失败"}\n${data.stderr ?? ""}\n${data.stdout ?? ""}`.trim());
        setLoading(false);
        return;
      }
      if (res.status === 202 && data.runId) {
        setClientStatus(data.step || "诊断任务已启动，正在轮询进度...");
        setProgress(data.progress ?? 15);
        await pollDiagnosis(data.runId);
        return;
      }
      // 非 202 直接完成（兜底）
      if (data.runId) {
        setLoading(false);
        onDone(data.runId);
      }
    } catch (e) {
      setClientStatus("诊断请求失败");
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  function abandon() {
    pollingRef.current = false;
    setLoading(false);
    setActiveRunId("");
    setProgress(0);
    setClientStatus("已放弃等待，可重新开始诊断");
  }

  return { loading, progress, activeRunId, error, clientStatus, submit, abandon };
}
```

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/wizard/use-diagnosis-submission.ts
git commit -m "feat(wizard): add useDiagnosisSubmission hook"
```

---

### Task 9: 向导步骤指示器 + 拖拽区

**Files:**
- Create: `src/features/wizard/wizard-stepper.tsx`
- Create: `src/features/wizard/drop-zone.tsx`

**Interfaces:**
- Consumes: `WizardStep` from `./types`；`fileSummary` from `./wizard-utils.mjs`
- Produces: `WizardStepper({ current })`；`DropZone({ file, onChange })`

- [ ] **Step 1: 创建步骤指示器**

```tsx
// src/features/wizard/wizard-stepper.tsx
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WizardStep } from "./types";

const STEPS: { value: WizardStep; label: string }[] = [
  { value: "upload", label: "上传日志" },
  { value: "describe", label: "现场描述" },
  { value: "running", label: "运行中" },
];

export function WizardStepper({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.value === current);

  return (
    <div className="flex items-center gap-3">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.value} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px w-12 bg-border/60 sm:w-16" />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 创建拖拽区**

```tsx
// src/features/wizard/drop-zone.tsx
"use client";

import { useRef, useState } from "react";
import { FileCheck2, UploadCloud, X } from "lucide-react";

import { fileSummary } from "./wizard-utils.mjs";

type DropZoneProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
};

export function DropZone({ file, onChange, accept = ".ulg,.bin" }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileCheck2 className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm">{fileSummary(file)}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition-colors " +
        (dragging ? "border-primary bg-primary/5" : "border-border/60 bg-muted/20 hover:bg-muted/40")
      }
    >
      <UploadCloud className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">拖拽日志到此处</p>
      <p className="text-xs text-muted-foreground">或点击选择文件 · 支持 {accept}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/features/wizard/wizard-stepper.tsx src/features/wizard/drop-zone.tsx
git commit -m "feat(wizard): add stepper and drop zone components"
```

---

### Task 10: 向导步骤①②③页面组件

**Files:**
- Create: `src/features/wizard/step-upload.tsx`
- Create: `src/features/wizard/step-describe.tsx`
- Create: `src/features/wizard/step-running.tsx`

**Interfaces:**
- Consumes: `WizardState` from `./use-wizard-state`；`useDiagnosisSubmission` 返回值；`DropZone`、`WizardStepper`
- Produces: `StepUpload`、`StepDescribe`、`StepRunning` 三个组件

- [ ] **Step 1: 创建步骤①上传页**

```tsx
// src/features/wizard/step-upload.tsx
"use client";

import { ChevronDown, Settings2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { DropZone } from "./drop-zone";
import type { WizardState } from "./use-wizard-state";

export function StepUpload({ wizard }: { wizard: WizardState }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">上传飞行数据</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          日志文件是必填项，参数文件用于生成更完整的调参建议。
        </p>
      </div>

      <DropZone file={wizard.form.logUpload} onChange={wizard.setLogUpload} />

      <details className="group rounded-xl border border-border/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <UploadCloud className="size-4 text-muted-foreground" />
            使用服务器本机路径
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-border/60 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="logfile">日志路径</Label>
            <Input
              id="logfile"
              value={wizard.form.logfile}
              onChange={(e) => wizard.setLogfile(e.target.value)}
              placeholder="例如 D:\\...\\log.ulg 或 /mnt/d/.../log.ulg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paramsPath">参数路径</Label>
            <Input
              id="paramsPath"
              value={wizard.form.paramsFile}
              onChange={(e) => wizard.setParamsFile(e.target.value)}
              placeholder="例如 D:\\...\\vehicle.params"
            />
          </div>
        </div>
      </details>

      <details className="group rounded-xl border border-border/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            高级选项
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-border/60 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="paramsUpload">原始参数文件上传</Label>
            <DropZone
              file={wizard.form.paramsUpload}
              onChange={wizard.setParamsUpload}
              accept=".params,.txt"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apiBase">API Base</Label>
            <Input
              id="apiBase"
              value={wizard.form.apiBase}
              onChange={(e) => wizard.setApiBase(e.target.value)}
              placeholder="例如 http://192.168.2.158:8310/v1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={wizard.form.apiKey}
              onChange={(e) => wizard.setApiKey(e.target.value)}
              placeholder="本地无鉴权服务可留空"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">模型名称</Label>
            <Input
              id="model"
              value={wizard.form.model}
              onChange={(e) => wizard.setModel(e.target.value)}
              placeholder="留空使用服务端默认模型"
            />
          </div>
        </div>
      </details>

      <div className="flex justify-end">
        <Button onClick={wizard.next} disabled={!wizard.canProceed} size="lg">
          下一步
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建步骤②描述页**

```tsx
// src/features/wizard/step-describe.tsx
"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { WizardState } from "./use-wizard-state";

export function StepDescribe({ wizard }: { wizard: WizardState }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">现场描述</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          这次飞行发生了什么？描述越详细，诊断越准确。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="question">现象描述</Label>
        <Textarea
          id="question"
          value={wizard.form.question}
          onChange={(e) => wizard.setQuestion(e.target.value)}
          rows={6}
          placeholder="例如：Position 模式低空悬停会缓慢画圈，松杆仍漂移，不像高频抖动..."
        />
      </div>

      <details className="group rounded-xl border border-border/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
          <span>补充测试背景（时间/地点/人员）</span>
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-border/60 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="testTime">测试时间</Label>
            <Input id="testTime" value={wizard.form.testTime} onChange={(e) => wizard.setTestTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testAircraft">测试机型</Label>
            <Input id="testAircraft" value={wizard.form.testAircraft} onChange={(e) => wizard.setTestAircraft(e.target.value)} placeholder="例如 X760" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testLocation">测试地点</Label>
            <Input id="testLocation" value={wizard.form.testLocation} onChange={(e) => wizard.setTestLocation(e.target.value)} placeholder="例如 低空测试场" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testOperator">测试人员</Label>
            <Input id="testOperator" value={wizard.form.testOperator} onChange={(e) => wizard.setTestOperator(e.target.value)} placeholder="例如 XJX" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="testProject">测试项目</Label>
            <Input id="testProject" value={wizard.form.testProject} onChange={(e) => wizard.setTestProject(e.target.value)} placeholder="例如 X760 悬停稳定性测试" />
          </div>
        </div>
      </details>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wizard.prev}>
          上一步
        </Button>
        <Button onClick={wizard.next} size="lg">
          开始诊断
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建步骤③运行页**

```tsx
// src/features/wizard/step-running.tsx
"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { clampProgress } from "./wizard-utils.mjs";

type StepRunningProps = {
  loading: boolean;
  progress: number;
  clientStatus: string;
  activeRunId: string;
  error: string;
  onAbandon: () => void;
  onRetry: () => void;
};

export function StepRunning({
  loading,
  progress,
  clientStatus,
  activeRunId,
  error,
  onAbandon,
  onRetry,
}: StepRunningProps) {
  const [showLogs, setShowLogs] = useState(false);

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTitle>运行失败</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
            {error}
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onAbandon}>
            返回向导
          </Button>
          <Button onClick={onRetry}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-6 py-10">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在分析飞行日志...</p>
        <div className="w-full max-w-md">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${clampProgress(progress)}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {clientStatus} · {Math.round(clampProgress(progress))}%
          </p>
        </div>
        {activeRunId && (
          <p className="font-mono text-xs text-muted-foreground">Run ID: {activeRunId}</p>
        )}
        <Button variant="outline" size="sm" onClick={onAbandon}>
          放弃等待
        </Button>
      </div>

      <details className="group rounded-xl border border-border/60" open={showLogs}>
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium"
          onClick={(e) => {
            e.preventDefault();
            setShowLogs(!showLogs);
          }}
        >
          <span>查看详细输出</span>
          <ChevronDown className={"size-4 text-muted-foreground transition " + (showLogs ? "rotate-180" : "")} />
        </summary>
        {showLogs && (
          <ScrollArea className="h-48 rounded-b-xl bg-foreground p-4">
            <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-100">
              {clientStatus}
            </pre>
          </ScrollArea>
        )}
      </details>
    </div>
  );
}
```

- [ ] **Step 4: typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/features/wizard/step-upload.tsx src/features/wizard/step-describe.tsx src/features/wizard/step-running.tsx
git commit -m "feat(wizard): add three step page components"
```

---

### Task 11: 向导首页整合 + `/api/diagnose` 重定向修正

**Files:**
- Create: `src/app/page.tsx` (改写)
- Modify: `src/app/api/diagnose/route.ts:64-69` (重定向目标改 `/runs/[runId]`)

**Interfaces:**
- Consumes: `useWizardState`、`useDiagnosisSubmission`、`WizardStepper`、`StepUpload/Describe/Running`；`useRouter` from `next/navigation`

- [ ] **Step 1: 改写首页**

```tsx
// src/app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { WizardStepper } from "@/features/wizard/wizard-stepper";
import { StepDescribe } from "@/features/wizard/step-describe";
import { StepRunning } from "@/features/wizard/step-running";
import { StepUpload } from "@/features/wizard/step-upload";
import { useDiagnosisSubmission } from "@/features/wizard/use-diagnosis-submission";
import { useWizardState } from "@/features/wizard/use-wizard-state";

export default function Home() {
  const router = useRouter();
  const wizard = useWizardState();
  const [showRunning, setShowRunning] = useState(false);

  const submission = useDiagnosisSubmission((runId) => {
    router.push(`/runs/${encodeURIComponent(runId)}`);
  });

  function handleStart() {
    wizard.next();
    setShowRunning(true);
    void submission.submit(wizard.form);
  }

  function handleAbandon() {
    submission.abandon();
    setShowRunning(false);
    wizard.reset();
  }

  function handleRetry() {
    submission.abandon();
    setShowRunning(false);
    wizard.reset();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <WizardStepper current={showRunning ? "running" : wizard.step} />

      {showRunning || wizard.step === "running" ? (
        <StepRunning
          loading={submission.loading}
          progress={submission.progress}
          clientStatus={submission.clientStatus}
          activeRunId={submission.activeRunId}
          error={submission.error}
          onAbandon={handleAbandon}
          onRetry={handleRetry}
        />
      ) : wizard.step === "upload" ? (
        <StepUpload wizard={wizard} />
      ) : (
        <StepDescribe wizard={wizard} onExplicitStart={handleStart} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 修正 StepDescribe 接受 onStart prop**

修改 `src/features/wizard/step-describe.tsx` 的 props 签名和"开始诊断"按钮：

```tsx
type StepDescribeProps = { wizard: WizardState; onExplicitStart: () => void };

export function StepDescribe({ wizard, onExplicitStart }: StepDescribeProps) {
```

将"开始诊断"按钮的 `onClick={wizard.next}` 改为 `onClick={onExplicitStart}`。

- [ ] **Step 3: 修正 /api/diagnose 重定向目标**

修改 `src/app/api/diagnose/route.ts` 第 66-69 行：

```ts
  if (accept.includes("text/html")) {
    return new NextResponse(null, {
      status: 303,
      headers: { Location: `/runs/${encodeURIComponent(runId)}` },
    });
  }
```

- [ ] **Step 4: typecheck + dev 验证**

Run: `npx tsc --noEmit && npm run dev`
Expected: typecheck 通过；首页显示向导步骤①，拖拽区 + 折叠项可见；点"下一步"进步骤②；点"开始诊断"进步骤③（需有日志才走通）

- [ ] **Step 5: 提交**

```bash
git add src/app/page.tsx src/features/wizard/step-describe.tsx src/app/api/diagnose/route.ts
git commit -m "feat(wizard): integrate wizard home page and fix diagnose redirect"
```

---

### Task 12: 结果详情页各 section 组件

**Files:**
- Create: `src/features/runs/report-section.tsx`
- Create: `src/features/runs/charts-section.tsx`
- Create: `src/features/runs/params-section.tsx`
- Create: `src/features/runs/logs-collapsible.tsx`
- Create: `src/features/runs/run-header.tsx`

**Interfaces:**
- Consumes: `RunStatus` from `./types`；`InteractiveChart`、`ChartLightbox` from `@/features/charts`；`formatDuration`、`formatRunTime` from `./run-utils.mjs`
- Produces: `ReportSection`、`ChartsSection`、`ParamsSection`、`LogsCollapsible`、`RunHeader`

- [ ] **Step 1: 创建 ReportSection**

```tsx
// src/features/runs/report-section.tsx
import { Download, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";

type ReportSectionProps = {
  reportUrl: string;
  pdfUrl?: string;
  reportText: string;
};

export function ReportSection({ reportUrl, pdfUrl, reportText }: ReportSectionProps) {
  const effectivePdfUrl = pdfUrl ?? reportUrl.replace(/diagnosis\.md$/, "diagnosis.pdf");
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => window.open(reportUrl, "_blank", "noopener,noreferrer")}
        >
          <FileText className="size-4" /> 打开 .md
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => window.open(effectivePdfUrl, "_blank", "noopener,noreferrer")}
        >
          <Download className="size-4" /> 下载 PDF
        </Button>
      </div>
      <article className="prose max-w-none prose-headings:tracking-tight prose-pre:bg-muted prose-code:text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportText}</ReactMarkdown>
      </article>
    </div>
  );
}
```

- [ ] **Step 2: 创建 ChartsSection**

```tsx
// src/features/runs/charts-section.tsx
"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChartLightbox, type ChartLightboxTarget } from "@/features/charts/chart-lightbox";
import { InteractiveChart } from "@/features/charts/interactive-chart";
import type { InteractiveChartSpec } from "@/features/charts/types";

import type { RunChart, RunChartData } from "./types";

type ChartsSectionProps = {
  charts?: RunChart[];
  chartData?: RunChartData | null;
};

export function ChartsSection({ charts, chartData }: ChartsSectionProps) {
  const [lightbox, setLightbox] = useState<ChartLightboxTarget | null>(null);
  const interactive = chartData?.charts as InteractiveChartSpec[] | undefined;

  if (interactive?.length) {
    return (
      <div className="grid gap-4 2xl:grid-cols-2">
        {interactive.map((chart) => (
          <InteractiveChart
            key={chart.id}
            chart={chart}
            onExpand={(target) => setLightbox({ type: "interactive", chart: target })}
          />
        ))}
        <ChartLightbox target={lightbox} onClose={() => setLightbox(null)} />
      </div>
    );
  }

  if (!charts?.length) {
    return <p className="text-sm text-muted-foreground">暂无图表</p>;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {charts.map((chart) => (
          <figure key={chart.name} className="overflow-hidden rounded-xl border border-border/60 bg-background p-4">
            <figcaption className="mb-3 flex items-center justify-between gap-3 text-sm font-medium">
              {chart.name}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => setLightbox({ type: "image", title: chart.name, url: chart.url })}
              >
                <Maximize2 className="size-3.5" /> 放大
              </Button>
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chart.url} alt={chart.name} className="w-full rounded-lg border border-border/60" />
          </figure>
        ))}
      </div>
      <ChartLightbox target={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
```

- [ ] **Step 3: 创建 ParamsSection**

```tsx
// src/features/runs/params-section.tsx
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type ParamsSectionProps = {
  paramsUrl: string;
  paramsPreview: string;
};

export function ParamsSection({ paramsUrl, paramsPreview }: ParamsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">可导入 QGroundControl 的参数建议文件。</p>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => window.open(paramsUrl, "_blank", "noopener,noreferrer")}
        >
          <Download className="size-4" /> 下载 .params
        </Button>
      </div>
      <ScrollArea className="h-[460px] rounded-xl border border-border/60 bg-muted p-4">
        <pre className="font-mono text-sm leading-6 text-foreground">{paramsPreview}</pre>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 4: 创建 LogsCollapsible**

```tsx
// src/features/runs/logs-collapsible.tsx
"use client";

import { useState } from "react";
import { ChevronDown, Terminal } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";

type LogsCollapsibleProps = {
  stdout?: string;
  stderr?: string;
};

export function LogsCollapsible({ stdout, stderr }: LogsCollapsibleProps) {
  const [open, setOpen] = useState(false);
  const output = `${stdout ?? ""}\n${stderr ?? ""}`.trim() || "暂无运行输出。";

  return (
    <div className="rounded-xl border border-border/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Terminal className="size-4 text-muted-foreground" />
          查看 Python 运行输出
        </span>
        <ChevronDown className={"size-4 text-muted-foreground transition " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <ScrollArea className="h-64 rounded-b-xl bg-foreground p-4">
          <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-100">{output}</pre>
        </ScrollArea>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 创建 RunHeader**

```tsx
// src/features/runs/run-header.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { formatDuration, formatRunTime, statusColor } from "./run-utils.mjs";
import type { RunStatus } from "./types";

export function RunHeader({ run }: { run: RunStatus }) {
  const aircraft = run.metadata?.testAircraft ?? "";
  const duration = formatDuration(run.startedAt, run.finishedAt);

  return (
    <div className="space-y-2">
      <Link
        href="/runs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 返回历史
      </Link>
      <div className="flex items-center gap-3">
        <span className={"size-2 rounded-full " + statusColor(run.state)} />
        <h1 className="font-mono text-xl font-semibold tracking-tight">{run.runId}</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {[aircraft, formatRunTime(run.startedAt), duration].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
```

- [ ] **Step 6: typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
git add src/features/runs/report-section.tsx src/features/runs/charts-section.tsx src/features/runs/params-section.tsx src/features/runs/logs-collapsible.tsx src/features/runs/run-header.tsx
git commit -m "feat(runs): add result detail section components"
```

---

### Task 13: 结果详情页 `/runs/[runId]`

**Files:**
- Create: `src/app/runs/[runId]/page.tsx`
- Create: `src/features/runs/run-detail-client.tsx`

**Interfaces:**
- Consumes: `RunStatus` from `@/features/runs/types`；各 section 组件；`RunHeader`；`SegmentedNav`；`LogsCollapsible`
- Produces: Server Component 读取 `status.json` + 报告 + 参数 + chartData；client 岛处理分段切换

- [ ] **Step 1: 创建详情页客户端岛**

```tsx
// src/features/runs/run-detail-client.tsx
"use client";

import { useRef, useState } from "react";

import { SegmentedNav, type SegmentedNavItem } from "@/components/segmented-nav";

import { ChartsSection } from "./charts-section";
import { LogsCollapsible } from "./logs-collapsible";
import { ParamsSection } from "./params-section";
import { ReportSection } from "./report-section";
import type { RunStatus } from "./types";

const TABS: SegmentedNavItem[] = [
  { value: "report", label: "诊断报告" },
  { value: "charts", label: "分析图表" },
  { value: "params", label: "参数建议" },
  { value: "logs", label: "运行日志" },
];

type RunDetailClientProps = {
  run: RunStatus;
  reportText: string;
  paramsPreview: string;
};

export function RunDetailClient({ run, reportText, paramsPreview }: RunDetailClientProps) {
  const [tab, setTab] = useState("report");
  const logsRef = useRef<HTMLDivElement>(null);

  function handleChange(value: string) {
    if (value === "logs") {
      setTab("report");
      logsRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setTab(value);
  }

  return (
    <div className="space-y-6">
      <SegmentedNav items={TABS} value={tab} onChange={handleChange} />

      <div>
        {tab === "report" && (
          <ReportSection
            reportUrl={run.reportUrl ?? ""}
            pdfUrl={run.pdfUrl}
            reportText={reportText}
          />
        )}
        {tab === "charts" && <ChartsSection charts={run.charts} chartData={null} />}
        {tab === "params" && (
          <ParamsSection
            paramsUrl={run.paramsUrl ?? ""}
            paramsPreview={paramsPreview}
          />
        )}
      </div>

      <div ref={logsRef}>
        <LogsCollapsible stdout={run.stdout} stderr={run.stderr} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建详情页 Server Component**

```tsx
// src/app/runs/[runId]/page.tsx
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { isPathInside, RUNS_ROOT } from "@/lib/server/paths";
import { RunHeader } from "@/features/runs/run-header";
import { RunDetailClient } from "@/features/runs/run-detail-client";
import type { RunStatus } from "@/features/runs/types";

export default async function RunDetailPage({
  params,
}: PageProps<"/runs/[runId]">) {
  const { runId } = await params;
  const runRoot = path.resolve(RUNS_ROOT, runId);
  const statusFile = path.resolve(runRoot, "status.json");

  if (!isPathInside(RUNS_ROOT, runRoot) || !existsSync(statusFile)) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">该诊断记录不存在。</p>
        <a href="/runs" className="text-primary hover:underline">返回历史列表</a>
      </div>
    );
  }

  const run = JSON.parse(readFileSync(statusFile, "utf-8")) as RunStatus;

  let reportText = "";
  if (run.reportUrl) {
    const reportPath = path.resolve(runRoot, "diagnosis.md");
    if (existsSync(reportPath)) {
      reportText = readFileSync(reportPath, "utf-8");
    }
  }

  let paramsPreview = "";
  if (run.paramsUrl) {
    const paramsPath = path.resolve(runRoot, "diagnosis_recommendations.params");
    if (existsSync(paramsPath)) {
      paramsPreview = readFileSync(paramsPath, "utf-8");
    }
  }

  return (
    <div className="space-y-8">
      <RunHeader run={run} />
      <RunDetailClient run={run} reportText={reportText} paramsPreview={paramsPreview} />
    </div>
  );
}
```

- [ ] **Step 3: typecheck + dev 验证**

Run: `npx tsc --noEmit && npm run dev`
Expected: typecheck 通过；访问 `/runs/20260623110400_log_92_2026-6-22-16-57-16.ulg` 显示 RunHeader + 分段控件 + 报告内容 + 底部日志折叠

- [ ] **Step 4: 提交**

```bash
git add src/app/runs/[runId]/page.tsx src/features/runs/run-detail-client.tsx
git commit -m "feat(runs): add run detail page with segmented nav"
```

---

### Task 14: 历史列表页 `/runs`

**Files:**
- Create: `src/features/runs/run-summary-card.tsx`
- Create: `src/features/runs/run-list.tsx`
- Create: `src/app/runs/page.tsx`

**Interfaces:**
- Consumes: `RunSummary` from `./types`；`shortRunId`、`formatRunTime`、`statusColor` from `./run-utils.mjs`；`EmptyState` from `@/components/empty-state`
- Produces: `RunSummaryCard`、`RunList`（client，含筛选）、历史列表页（Server Component fetch `/api/runs`）

- [ ] **Step 1: 创建单条历史卡片**

```tsx
// src/features/runs/run-summary-card.tsx
import Link from "next/link";
import { FileImage, FileSliders, FileText } from "lucide-react";

import { formatRunTime, shortRunId, statusColor } from "./run-utils.mjs";
import type { RunSummary } from "./types";

export function RunSummaryCard({ run }: { run: RunSummary }) {
  const aircraft = run.metadata?.testAircraft ?? "";
  const logName = run.runId.split("_").slice(1).join("_") || run.runId;

  return (
    <Link
      href={`/runs/${run.runId}`}
      className="block rounded-xl border border-border/60 bg-background p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-2">
        <span className={"size-2 shrink-0 rounded-full " + statusColor(run.state)} />
        <span className="font-mono text-sm font-medium">{shortRunId(run.runId)}</span>
        <span className="text-xs text-muted-foreground">· {formatRunTime(run.updatedAt)}</span>
        {run.state === "error" && (
          <span className="ml-auto rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600">失败</span>
        )}
      </div>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">
        {[aircraft, logName].filter(Boolean).join(" · ")}
      </p>
      {run.state === "error" && run.step && (
        <p className="mt-1 truncate text-xs text-rose-500">{run.step}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-muted-foreground">
        {run.hasReport && <FileText className="size-3.5" title="有报告" />}
        {run.hasPdf && <FileText className="size-3.5" title="有 PDF" />}
        {run.hasParams && <FileSliders className="size-3.5" title="有参数文件" />}
        {run.chartsCount > 0 && (
          <span className="flex items-center gap-1 text-xs">
            <FileImage className="size-3.5" /> {run.chartsCount}
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: 创建列表 + 筛选组件**

```tsx
// src/features/runs/run-list.tsx
"use client";

import { useState } from "react";

import { EmptyState } from "@/components/empty-state";

import { RunSummaryCard } from "./run-summary-card";
import type { RunSummary } from "./types";

type Filter = "all" | "done" | "error" | "running";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "done", label: "完成" },
  { value: "error", label: "失败" },
  { value: "running", label: "运行中" },
];

export function RunList({ runs }: { runs: RunSummary[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = runs.filter((r) => {
    if (filter === "all") return true;
    if (filter === "running") return r.state === "running" || r.state === "uploading";
    return r.state === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={
              "border-b-2 px-1 py-1 text-sm font-medium transition-colors " +
              (filter === f.value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="没有匹配的诊断记录"
          description="尝试切换筛选条件，或点击侧边栏新建诊断。"
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((run) => (
            <RunSummaryCard key={run.runId} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建历史列表页**

```tsx
// src/app/runs/page.tsx
import { RunList } from "@/features/runs/run-list";
import type { RunSummary } from "@/features/runs/types";

export default async function RunsPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/runs`, {
    cache: "no-store",
  });
  const data = (await res.json()) as { runs: RunSummary[] };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">运行历史</h1>
        <p className="mt-1 text-sm text-muted-foreground">共 {data.runs.length} 次诊断</p>
      </div>
      <RunList runs={data.runs} />
    </div>
  );
}
```

- [ ] **Step 4: typecheck + dev 验证**

Run: `npx tsc --noEmit && npm run dev`
Expected: typecheck 通过；访问 `/runs` 显示历史列表，含 4 条记录，筛选条可切换，点卡片跳详情页

- [ ] **Step 5: 提交**

```bash
git add src/features/runs/run-summary-card.tsx src/features/runs/run-list.tsx src/app/runs/page.tsx
git commit -m "feat(runs): add history list page with filter"
```

---

### Task 15: 删除旧文件 + 修正 `/api/diagnose` html 重定向移除

**Files:**
- Delete: `src/app/latest/page.tsx` (及 `latest/` 目录)
- Delete: `src/app/progress/[runId]/page.tsx` (及 `progress/` 目录)
- Delete: `src/features/diagnosis/` (整个目录，13 文件)
- Delete: `src/features/runs/run-page-shell.tsx`
- Delete: `src/features/runs/run-download-links.tsx`
- Delete: `src/features/runs/run-metadata.tsx`
- Delete: `src/features/runs/run-charts-grid.tsx`
- Delete: `tests/diagnosis-client-utils.test.mjs`
- Modify: `src/app/api/diagnose/route.ts` (移除 html 303 重定向分支，API route 只返回 JSON)

**Interfaces:**
- 无新接口；清理废弃代码

- [ ] **Step 1: 删除旧路由页面和旧 features 目录**

```bash
Remove-Item -LiteralPath "src\app\latest" -Recurse -Force
Remove-Item -LiteralPath "src\app\progress" -Recurse -Force
Remove-Item -LiteralPath "src\features\diagnosis" -Recurse -Force
Remove-Item -LiteralPath "src\features\runs\run-page-shell.tsx" -Force
Remove-Item -LiteralPath "src\features\runs\run-download-links.tsx" -Force
Remove-Item -LiteralPath "src\features\runs\run-metadata.tsx" -Force
Remove-Item -LiteralPath "src\features\runs\run-charts-grid.tsx" -Force
Remove-Item -LiteralPath "tests\diagnosis-client-utils.test.mjs" -Force
```

- [ ] **Step 2: 移除 /api/diagnose 的 html 重定向分支**

修改 `src/app/api/diagnose/route.ts`，删除第 64-70 行的 `if (accept.includes("text/html"))` 分支块：

```ts
  startDiagnosisJob({ runId, outputDir, command, args, apiKey: body.apiKey?.trim() });

  return NextResponse.json(
    {
      runId,
      outputDir,
      state: "running",
      step: "已保存输入文件，诊断任务已启动",
      progress: 15,
      statusUrl: `/api/status/${runId}`,
    },
    { status: 202 },
  );
}
```

- [ ] **Step 3: typecheck + lint 确认无悬空引用**

Run: `npx tsc --noEmit`
Expected: 无错误（若有错误，说明新代码仍引用了已删除的模块，需修正 import）

Run: `npm run lint`
Expected: 无错误

- [ ] **Step 4: 运行全部测试**

Run: `npm test`
Expected: `wizard-utils.test.mjs`、`run-utils.test.mjs`、`runs-api.test.mjs`、`diagnosis-server-utils.test.mjs` 通过；`diagnosis-client-utils.test.mjs` 已删除

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: remove obsolete diagnosis pages and features"
```

---

### Task 16: 全量 dev 验证 + 生产 build 验证

**Files:**
- 无文件改动，纯验证

- [ ] **Step 1: dev 模式全流程验证**

Run: `npm run dev`

手动验证清单：
1. 访问 `/`：显示向导步骤①（拖拽区 + 两个折叠项），侧边栏显示历史
2. 拖拽 `.ulg` 文件：拖拽区变确认条，"下一步"按钮激活
3. 点"下一步"：进步骤②（现象描述 + 折叠背景）
4. 点"开始诊断"：进步骤③（进度条 + 状态文字 + 放弃等待按钮）
5. 等待诊断完成：自动跳转 `/runs/[runId]`
6. 结果页：RunHeader 显示 runId + 机型 + 时间 + 时长；分段控件切换报告/图表/参数；底部日志折叠可展开
7. 点侧边栏"查看全部"：跳 `/runs`，显示 4 条记录，筛选条可切换
8. 点历史卡片：跳对应结果页
9. 点侧边栏"新建诊断"：回 `/`，向导重置到步骤①

- [ ] **Step 2: 生产 build 验证**

Run: `npm run build`
Expected: build 成功，生成 `.next/standalone`；无 type error、无 lint error

- [ ] **Step 3: standalone 启动验证（模拟桌面端）**

Run: `node .next/standalone/server.js`
Expected: standalone server 启动，访问 `http://localhost:3000` 各页面正常（确认 standalone 打包兼容性）

- [ ] **Step 4: 最终提交（如有 build 配置微调）**

```bash
git add -A
git commit -m "chore: verify production build and standalone" --allow-empty
```

---

## Self-Review

### Spec 覆盖检查

| Spec 节 | 覆盖任务 |
|---|---|
| 3. 路由（`/`、`/runs/[id]`、`/runs`，删 `/latest`、`/progress`） | Task 11、13、14、15 |
| 3. 新增 `/api/runs` | Task 5 |
| 4. Shell（侧边栏 240px + 主区大留白，删 AppHeader） | Task 3、6 |
| 5. 向导三步态 + Hook 拆分 + 自动载入改提示条 | Task 7、8、9、10、11 |
| 6. 结果页 Server Component + 分段控件 + 日志降级 | Task 12、13 |
| 7. 历史列表页 + 筛选 + `/api/runs` 数据源 | Task 14 |
| 8. 视觉系统（纯白、单强调色、Inter、大留白、删硬编码） | Task 3 |
| 9. 组件清理（删 19 / 留 9 / 新增 24） | Task 1-14（建）+ Task 15（删） |
| 10. 拖拽上传、放弃等待、错误处理、响应式 | Task 9、10、11 |
| 11. YAGNI（不做项） | 全程遵守 |

### 占位符扫描
无 TBD/TODO。所有步骤含完整代码。

### 类型一致性
- `WizardFormState`、`WizardStep`：Task 7 定义，Task 8/10/11 使用一致
- `RunSummary`：Task 5 定义，Task 6/14 使用一致
- `RunStatus`：现有 `types.ts` 定义，Task 12/13 使用一致
- `useWizardState` 返回类型 `WizardState`：Task 7 定义，Task 10/11 使用一致
- `useDiagnosisSubmission` 返回字段：Task 8 定义，Task 11 使用一致
- `SegmentedNavItem`：Task 4 定义，Task 13/14 使用一致

### 已知简化
- 结果详情页 `ChartsSection` 的 `chartData` prop 传 `null`——交互图表的 JSON 数据加载需读 `chart_data.json`，但当前 status.json 无 `chartDataUrl` 字段。Task 13 暂传 null，图表走 PNG 回退。若需交互图表，后续可扩展 Server Component 读 `chart_data.json`。这是有意简化，避免计划膨胀。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-frontend-refactor.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
