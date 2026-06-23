# 前端界面重构设计

- 日期：2026-06-24
- 状态：待评审
- 范围：`frontend/` 全部界面交互重建，后端 API 契约冻结

## 1. 背景与目标

当前前端为单页双栏布局：左栏 440px 诊断控制台表单（上传文件→测试背景 5 字段→现象描述→折叠的 LLM 设置→开始按钮），右栏 4 个 Tab（报告/图表/参数/日志），顶部塞了 Logo+徽章+标题+副标题+状态条+链接的大 AppHeader。问题：单屏信息过载、嵌套卡片/边框层叠、表单字段密集、header 信息过载、视觉渐变与硬编码色制造不一致。

目标：彻底重建交互，采用**向导式诊断为首屏 + 历史从侧边栏进入 + 极简留白视觉**。参考 Linear / Vercel / Stripe 气质：大量留白、细边框、几乎无阴影、黑白灰为主 + 单强调色、精细排版。

## 2. 约束

- **后端 API 契约冻结**：现有 4 个 API route（`/api/diagnose`、`/api/status/[runId]`、`/api/latest`、`/api/runs/[...path]`）的数据契约不变，不改动后端 Python 诊断逻辑。
- **可新增 API route**：允许新增 `/api/runs` 列表接口。
- **桌面端打包兼容**：保证 Electron standalone 打包（`frontend/.next/standalone` + afterPack + backend CLI 路径）仍可用。
- **无暗色模式**。
- **字体**：引入 Inter（via `next/font/google`，build 时拉取，打包后离线可用）。

## 3. 信息架构与路由

### 路由结构

| 路由 | 页面 | 职责 |
|---|---|---|
| `/` | 新建诊断向导（首屏） | 上传→描述→开始，进度全屏展示 |
| `/runs/[runId]` | 结果详情页 | 报告/图表/参数/日志，URL 可分享回退 |
| `/runs` | 历史列表 | 全部运行卡片列表，按时间倒序 |

### 页面流转

```
首页向导 ──开始诊断──> 运行中(首页内) ──done──> /runs/[runId]
                                              │
侧边栏「新建」 <──────────────────────────────┘ 手动返回
侧边栏历史列表 ──点击──> /runs/[runId]
```

### 删除的路由

- `/latest`：最近报告职能并入侧边栏历史列表顶部。
- `/progress/[runId]`：独立进度页职能并入首页向导的运行态。

### 新增接口：`/api/runs`

扫描 `RUNS_ROOT`，对每个含 `status.json` 的子目录读取摘要字段，按 `updatedAt` 倒序返回。过滤非运行目录（无 `status.json` 的目录、散落 `.log` 文件）。

```ts
// GET /api/runs  →  { runs: RunSummary[] }
type RunSummary = {
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

- 不返回完整 stdout/stderr（字段过大）。`hasReport` 等由 `status.json` 里对应 url 是否存在判定，`chartsCount` 取 `charts.length`。
- 无分页（当前 runs/ 下仅 4 个运行，YAGNI）。一次性返回全量，前端排序/筛选。

### 保留的接口

- `/api/latest`：首页向导空闲时轮询，发现其他设备发起的新运行时提示用户。
- `/api/runs/[...path]`：静态文件访问，结果页加载报告/图表/参数。

## 4. 布局 Shell（侧边栏 + 主区）

### 整体结构

侧边栏固定 240px，主区自适应剩余宽度。所有页面共享的 `app/layout.tsx` Shell。

```
┌─────────────────────────────────────────────────┐
│ ┌─────────┐  ┌───────────────────────────────┐  │
│ │ 侧边栏   │  │  主内容区（路由页面）          │  │
│ │ (固定)   │  │                               │  │
│ │ 240px    │  │                               │  │
│ └─────────┘  └───────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 侧边栏内容（从上到下）

```
┌─────────────────────┐
│ ◆ Drone Tuning Agent │  Logo + 极简标题，无副标题无徽章
│                      │
│ [+ 新建诊断]          │  主按钮，点击跳 /（若已在 / 则重置向导）
│                      │
│ 运行历史              │  小标题
│ ─────────────────    │
│ ▸ run_a1b2 · 10:32   │  每条一行：runId 短码 + 时间
│   X760 · 完成        │  机型 + 状态点
│ ▸ run_c3d4 · 昨天    │
│   X760 · 完成        │
│ ▸ run_e5f6 · 3天前   │
│   X760 · 失败        │  失败用红点
│                      │
│ ─────────────────    │
│ 查看全部 →            │  链接到 /runs
└─────────────────────┘
```

- 历史条目数据源：`/api/runs`，取最近 8 条，底部"查看全部"跳 `/runs`。侧边栏和 `/runs` 页共享同一接口。
- 窄屏处理：`< lg` 断点折叠为顶部 hamburger 抽屉，从左滑入。桌面端（Electron 主战场）默认宽屏常驻。
- 移除 AppHeader：大 header 的职能拆分——Logo 和标题进侧边栏，状态/进度进各页面内部。

### 主区容器

```tsx
<main className="mx-auto max-w-[1400px] px-8 py-10">
```

比当前 `max-w-[1500px] px-4 py-4` 更大留白。主区不再有全局背景渐变，改纯 `bg-background`。

## 5. 首页向导页 `/`

向导是单页内步骤状态机，顶部极简步骤指示，不跳路由。

### 步骤指示

```
① 上传日志  ───  ② 现场描述  ───  ③ 运行中
   (活跃)         (待激活)         (待激活)
```

### 步骤 ①：上传日志

```
┌───────────────────────────────────────────────┐
│  ① 上传日志                            ② ③    │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │            [拖拽日志到此处]               │  │
│  │           或 点击选择文件                 │  │
│  │       支持 .ulg / .bin                   │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ▸ 使用服务器本机路径            (折叠)        │
│  ▸ 高级选项                      (折叠)        │
│                                                │
│                              [取消]  [下一步]  │
└───────────────────────────────────────────────┘
```

- 拖拽区为主角，大留白。选完文件后显示文件名+大小，拖拽区变为紧凑确认条。
- 「服务器本机路径」（logfile/paramsFile 输入）和「高级选项」（参数文件上传、LLM 设置：apiBase/apiKey/model）都是折叠区，默认收起。
- 「下一步」校验有日志（`logUpload` 或 `logfile.trim()`）后激活。

### 步骤 ②：现场描述

```
┌───────────────────────────────────────────────┐
│  ① ✓   ② 现场描述                   ③        │
│                                                │
│  这次飞行发生了什么？                           │
│  ┌─────────────────────────────────────────┐  │
│  │  例如：Position 模式低空悬停会缓慢画圈，  │  │
│  │  松杆仍漂移，不像高频抖动...              │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ▸ 补充测试背景（时间/地点/人员）  (折叠)      │
│                                                │
│                          [上一步]  [开始诊断]  │
└───────────────────────────────────────────────┘
```

- 现象描述（`question`）是唯一可见项，大文本框居中。
- 测试背景 5 字段（testTime/testLocation/testProject/testOperator/testAircraft）收进折叠区，默认折叠。测试背景**只在步骤②出现一次**，不在步骤①重复。
- 「开始诊断」触发提交。

### 步骤 ③：运行中（首页内全屏演进）

```
┌───────────────────────────────────────────────┐
│  ① ✓   ② ✓   ③ 运行中                          │
│                                                │
│                  正在分析飞行日志...             │
│            ████████████░░░░░░░  62%            │
│         解析振动 FFT 频谱 · 步骤 5/8            │
│                  [放弃等待]                    │
└───────────────────────────────────────────────┘
```

- 进度条 + 当前步骤文字（来自 `/api/status` 的 `step` 和 `progress`）。
- `done` → `router.push('/runs/' + runId)` 跳结果页。
- `error` → 原地显示错误 Alert + "重试"按钮（回步骤①，保留表单）。
- 移除实时 stdout/stderr 刷屏，改为可展开的"查看详细输出"折叠区，默认收起。
- "放弃等待"按钮：仅前端放弃轮询，停止 `pollDiagnosis` 循环回到步骤①，后端进程继续跑完（结果落 runs/，下次进入可见）。不改后端。

### 轮询自动载入逻辑

首页空闲时（步骤①且非 loading）仍每 2s 轮询 `/api/latest`。发现新运行且 `runId !== 当前已知` 时，**不再静默载入**（旧逻辑会静默 loadResult 打断向导）。改为顶部可关闭提示条：「检测到新诊断 run_xxx，[查看]」，用户主动点击才跳转。

### Hook 拆分

旧 `useDiagnosisRun`（189 行，20+ state）拆为两个职责单一的 hook：

- `useWizardState`：仅管步骤索引 + 表单字段（logfile/paramsFile/question/metadata/apiBase/apiKey/model/uploads）。
- `useDiagnosisSubmission`：仅管提交 + 轮询 + 结果跳转（loading/progress/activeRunId/error/status）。

两个 hook 组合，各自可独立测试。

## 6. 结果详情页 `/runs/[runId]`

### 页面结构

```
┌───────────────────────────────────────────────────┐
│  ← 返回                                            │
│                                                    │
│  run_a1b2c3                                        │
│  X760 · 2026-06-24 10:32 · 3 分 12 秒              │
│                                                    │
│  [诊断报告]  分析图表  参数建议  运行日志            │ ← 顶部分段控件
│  ──────────                                        │   下划线指示当前段
│                                                    │
│  （当前段内容，无外层 Card 包裹）                    │
└───────────────────────────────────────────────────┘
```

### 数据加载

Server Component（Next.js App Router），`/runs/[runId]` 在服务端读取 `status.json` 拿到 state/progress/step/timestamps/metadata/charts[]/urls，渲染首屏。交互图表组件用 `"use client"` 子岛。比首页向导的客户端 `loadResult` 拉取更符合 App Router 范式，利于分享预览。从侧边栏历史点进来的结果页也能正常工作，不依赖首页 state 传递。

### 关键变化（对比现有）

1. **删除每个面板的外层 Card 包装**：现有每面板都是 `<Card><CardHeader bg-muted/20><CardTitle/><CardDescription/></CardHeader><CardContent>...</CardContent></Card>`，层叠 border + 灰底 header。极简版直接裸内容，靠分段控件标题定位。

2. **顶部信息行替代旧 header**：旧 `RunPageShell` 有大 header（Logo+标题+副标题+返回按钮，全包在 border+shadow 卡里）。新版极简：左对齐 runId + 元信息一行，返回按钮在左上角小链接，无卡片包裹。

3. **分段控件替代 Tabs**：现有 shadcn TabsList 是 4 列 grid 按钮组 + 外包 border+shadow+padding 卡。新版用极简文字标签 + 底部 2px primary 下划线指示，hover 变 `text-foreground`。无背景框、无按钮组。

4. **内容区直接呈现，内部不再嵌套卡片**：
   - 诊断报告段：直接 `<article className="prose">` + ReactMarkdown，顶部右侧放"下载 PDF""打开 .md"两个 ghost 按钮。删除 `ScrollArea h-[640px]` 固定高度，让报告自然撑长，页面滚动。
   - 分析图表段：直接 grid 渲染 `InteractiveChart`（优先）或 PNG figure，无外层 Card。图表 figure 去掉 `shadow-sm`，只留细 border。
   - 参数建议段：参数预览区从 `bg-foreground` 深色面板 + emerald 绿字，改成浅色 `bg-muted` + 等宽字体 + 正常文字色。顶部右侧"下载 .params"ghost 按钮。固定高度 `ScrollArea` 保留（参数文件通常很长）。
   - 运行日志段：从主分段之一**降级为底部折叠区**。默认收起在页面底部"查看 Python 运行输出 ▸"，展开后显示。深色 `bg-foreground` 面板保留（日志终端感合理）。分段控件里仍保留"运行日志"项，点击则滚动到底部并展开折叠。

### 分段控件行为

`SegmentedNav`：水平文字标签，当前项底部 2px primary 下划线。4 段：诊断报告/分析图表/参数建议/运行日志。日志段点击则滚动到底部并展开折叠区。

## 7. 历史列表页 `/runs`

### 页面结构

```
┌───────────────────────────────────────────────────┐
│  运行历史                                           │
│  共 4 次诊断                                        │
│                                                    │
│  [全部]  完成  失败  运行中            ← 内联筛选    │
│  ────────                                          │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │ ● 20260623110400 · 6月23日 19:04            │  │ ← 状态点+runId短码+时间
│  │   X760 · log_92_2026-6-22-16-57-16.ulg      │  │ ← 机型+日志名
│  │   报告 · PDF · 参数 · 5 张图表               │  │ ← 产物图标行
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ ● 20260622154433 · 6月22日 23:44  [失败]     │  │ ← 红点 + 失败标签
│  │   X760 · log_92_2026-6-22-16-57-16.ulg      │  │
│  │   step: LLM 调用超时                         │  │ ← 失败时显示 step
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 关键决策

- 轻列表卡片替代网格：不展示 `RunMetadata`（双列字段网格）和 `RunDownloadLinks`（下载按钮）——它们属于详情页。列表卡片只一行元信息 + 一行产物图标，点击整卡进详情。
- 状态点用颜色区分：完成=绿点、失败=红点、运行中=蓝点（带脉冲）。不用 Badge 标签，靠点色 + 失败时的小 `[失败]` 标签，最轻量。
- 产物图标行：用 lucide 小图标（FileText/FileSliders/FileImage）表示"有报告/有参数/有图表"，灰色=有、不显示=无，纯图标 + 悬停 tooltip。
- 筛选条：内联文字按钮 `[全部] 完成 失败 运行中`，当前态加粗下划线。不用下拉选择，4 个状态用文字切换最快。
- 空态：无运行时显示 EmptyState「还没有诊断记录，点击侧边栏新建诊断开始」。
- 侧边栏历史 vs 列表页：侧边栏是最近 8 条精简版（runId 短码 + 时间 + 状态点，单行），`/runs` 是全量 + 筛选 + 多行卡片。共享 `/api/runs` 一个接口，侧边栏取 `runs.slice(0, 8)`。

## 8. 视觉系统（极简留白型）

### 配色

```
背景      bg-background     #FFFFFF (纯白，删掉当前线性渐变)
次背景    bg-muted          oklch(0.97 0.005 255) (极淡冷灰)
文字主    text-foreground   oklch(0.22 0.035 255)
文字次    text-muted-foreground  oklch(0.48 0.035 255)
边框      border            oklch(0.92 0.01 255) (比当前更淡)
主强调    primary           oklch(0.48 0.17 255) (保留现有蓝)
```

- **删除全局背景渐变**：`page.tsx` 和 `run-page-shell.tsx` 里 `linear-gradient(...)` 全部换成 `bg-background`。渐变是当前"混乱"的来源之一。
- **单强调色**：仅 primary 蓝。删除 accent 暖色（当前 `--accent: oklch(0.92 0.07 86)` 黄调），它在 FlowSummary 的 `bg-blue-50` 等硬编码处制造不一致。状态色用语义色（emerald/rose）单独定义，不进 accent token。
- **删除硬编码颜色**：`FlowSummary` 的 `bg-blue-50 text-blue-900`、`progress-status` 的 `bg-white`、各 Card 的 `bg-white/95` 等硬编码值，统一走 token。极简留白的关键是色板收敛。

### 字体

```
--font-sans:  "Inter", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif
--font-mono:  "JetBrains Mono", "Cascadia Code", monospace
```

保留现有 Microsoft YaHei 作为中文 fallback，主字体换 Inter（via `next/font/google`，build 时拉取，打包后离线可用）。

### 间距 / 圆角 / 阴影

| token | 现有 | 新值 | 理由 |
|---|---|---|---|
| `--radius` | 0.75rem | 0.75rem | 保留，已够现代 |
| 卡片 border | `border` | `border border-border/60` | 更淡 |
| 卡片 shadow | `shadow-sm` | `shadow-none` | 极简=靠边框不靠阴影 |
| 页面 padding | `px-4 py-4` | `px-8 py-10` | 大留白 |
| 区块间距 | `gap-5` | `gap-8` / `gap-10` | 更松 |

- **Card 组件减负**：当前 shadcn Card 默认带 header border + `bg-muted/20` 底色，堆积层级感。新规范：Card 默认无 header 底色、无 shadow、单层 `border border-border/60`。需要分隔时用 `divide-y` 而非嵌套 border。

### 图标

保留 lucide-react。统一 `size-4`（正文内）和 `size-5`（标题旁）两档，删除 `size-6` `size-3.5` 等碎片尺寸。AppHeader 的大 Logo 胶囊（`size-12` 容器 + Radar 图标）删除，侧边栏用 `size-5` 小 Logo + 文字。

## 9. 组件清理与文件归属

### 删除的文件 / 目录

| 路径 | 原因 |
|---|---|
| `src/app/latest/` | `/latest` 路由删除，职能并入侧边栏 |
| `src/app/progress/[runId]/` | `/progress/[runId]` 路由删除，职能并入向导运行态 |
| `src/features/diagnosis/app-header.tsx` | 大 header 移除，职能拆入侧边栏 |
| `src/features/diagnosis/diagnosis-form.tsx` | 向导重构，逻辑拆入新 hook |
| `src/features/diagnosis/result-tabs.tsx` | Tabs 架构废弃 |
| `src/features/diagnosis/report-panel.tsx` | 重写为 `runs/report-section.tsx` |
| `src/features/diagnosis/charts-panel.tsx` | 重写为 `runs/charts-section.tsx` |
| `src/features/diagnosis/params-panel.tsx` | 重写为 `runs/params-section.tsx` |
| `src/features/diagnosis/logs-panel.tsx` | 重写为 `runs/logs-collapsible.tsx` |
| `src/features/diagnosis/empty-state.tsx` | 通用 EmptyState 提到 `components/ui/` |
| `src/features/diagnosis/progress-status.tsx` | 进度展示并入向导运行态 |
| `src/features/diagnosis/file-picker.tsx` | 重写为向导专用拖拽上传 |
| `src/features/diagnosis/use-diagnosis-run.ts` | 巨型 hook 拆分 |
| `src/features/diagnosis/types.ts` | 类型拆分到各模块 |
| `src/features/diagnosis/client-utils.mjs` | 工具函数归位 |
| `src/features/diagnosis/` (整个目录) | 清空 |
| `src/features/runs/run-page-shell.tsx` | 大 header shell 废弃 |
| `src/features/runs/run-download-links.tsx` | 下载链接并入各 section |
| `src/features/runs/run-metadata.tsx` | 元信息并入详情页顶部 |

### 保留并复用的文件

| 路径 | 说明 |
|---|---|
| `src/features/charts/interactive-chart.tsx` | 交互图表核心，直接复用 |
| `src/features/charts/chart-lightbox.tsx` | 放大查看，直接复用 |
| `src/features/charts/types.ts` | 图表类型定义 |
| `src/lib/server/paths.ts` | 路径常量 |
| `src/lib/server/diagnosis-runner.ts` | 诊断执行器 |
| `src/lib/server/diagnosis-input.ts` | 输入处理 |
| `src/lib/server/diagnosis-utils.mjs` | 工具 |
| `src/components/ui/*` (11 个 shadcn 组件) | 保留，按需调整样式 |
| 现有 4 个 API route | 契约不变 |

### 新增文件

| 路径 | 职责 |
|---|---|
| `src/app/layout.tsx` (改) | 加入 Shell：侧边栏 + 主区 |
| `src/components/app-sidebar.tsx` | 侧边栏组件（Logo/新建/历史8条/查看全部） |
| `src/components/empty-state.tsx` | 通用空态，从旧 empty-state 提取 |
| `src/components/segmented-nav.tsx` | 极简分段控件（下划线指示） |
| `src/app/page.tsx` (重写) | 向导页，3 步状态机 |
| `src/features/wizard/wizard-stepper.tsx` | 步骤指示器 |
| `src/features/wizard/step-upload.tsx` | 步骤①上传（拖拽区+折叠高级项） |
| `src/features/wizard/step-describe.tsx` | 步骤②现场描述（现象+折叠背景） |
| `src/features/wizard/step-running.tsx` | 步骤③运行中（进度+可折叠日志） |
| `src/features/wizard/drop-zone.tsx` | 拖拽上传区组件 |
| `src/features/wizard/use-wizard-state.ts` | 向导步骤+表单状态 |
| `src/features/wizard/use-diagnosis-submission.ts` | 提交+轮询逻辑（从旧 hook 拆出） |
| `src/features/wizard/types.ts` | 向导类型 |
| `src/app/runs/page.tsx` | 历史列表页（Server Component） |
| `src/app/runs/[runId]/page.tsx` | 结果详情页（Server Component） |
| `src/features/runs/run-list.tsx` | 历史列表卡片 + 筛选（client） |
| `src/features/runs/run-summary-card.tsx` | 单条历史卡片 |
| `src/features/runs/run-detail-client.tsx` | 详情页客户端岛（分段切换） |
| `src/features/runs/report-section.tsx` | 报告段 |
| `src/features/runs/charts-section.tsx` | 图表段 |
| `src/features/runs/params-section.tsx` | 参数段 |
| `src/features/runs/logs-collapsible.tsx` | 日志折叠区 |
| `src/features/runs/run-header.tsx` | 详情页顶部信息行 |
| `src/features/runs/types.ts` (扩充) | 加 RunSummary 类型 |
| `src/app/api/runs/route.ts` | 新增列表接口 |

## 10. 交互细节与边界

### 拖拽上传

`DropZone` 组件：支持拖拽 + 点击选择。选中后变紧凑确认条（文件名 + 大小 + × 移除）。同时支持 `logfile` 路径输入（折叠的"服务器本机路径"）。校验：有 `logUpload` 或 `logfile.trim()` 非空才允许下一步。

### 运行态取消

当前无取消机制（后端诊断进程跑完为止）。`step-running` 的"放弃等待"按钮实际只做**前端放弃轮询**：停止 `pollDiagnosis` 循环，回到步骤①，后端进程继续跑完（结果会落在 runs/，下次进入可见）。

### 错误处理

- 提交失败（`/api/diagnose` 非 202/200）：向导步骤③原地显示错误 Alert + "重试"按钮（回步骤①，保留表单）
- 轮询失败（`/api/status` 连续错误）：显示错误 + "重试轮询"按钮，不自动跳转
- 结果页 `status.json` 不存在：404 页面 + "返回历史"链接

### 自动载入最近

首页空闲时（步骤①且非 loading）仍每 2s 轮询 `/api/latest`。发现新运行且 `runId !== 当前已知` 时，**不再静默载入**（旧逻辑会静默 loadResult 打断向导）。改为顶部出现一条可关闭的提示条：「检测到新诊断 run_xxx，[查看]」，用户主动点击才跳转。

### 分段控件（详情页）

`SegmentedNav`：水平文字标签，当前项底部 2px primary 下划线，hover 变 `text-foreground`。无背景框、无按钮组。4 段：诊断报告/分析图表/参数建议/运行日志。日志段点击则滚动到底部并展开折叠区——兼顾两种访问习惯。

### 响应式

- `lg+`（桌面/Electron 主战场）：侧边栏常驻 240px
- `< lg`：侧边栏收为 hamburger 抽屉，从左滑入
- 向导三步在 `< sm` 下步骤指示器简化为 "1/3" 文字
- 历史卡片在 `< md` 下产物图标行换行

### 测试

- 复用现有 `node --test tests/*.test.mjs`
- 新增 `tests/wizard-state.test.mjs`：测 `useWizardState` 步骤推进/回退、字段校验逻辑
- 新增 `tests/runs-api.test.mjs`：测 `/api/runs` 返回结构和非运行目录过滤
- 不做 e2e（项目无 e2e 框架，YAGNI）

## 11. 不做的事（YAGNI）

- 暗色模式（用户未选）
- 运行对比页
- 报告内搜索
- 实时 stdout 流式（轮询足够）
- 国际化（全中文）
- 后端改动（契约冻结）
- `/api/runs` 分页（当前仅 4 个运行）
