# ECharts 图表优化设计

- 日期：2026-06-24
- 状态：已批准（用户授权自行决策）
- 范围：前端图表展示从 PNG/手写 SVG 替换为 ECharts，接通交互数据，迁移旧运行数据

## 1. 背景与目标

当前结果详情页图表段只显示后端生成的 PNG 静态图。根因：`run-detail-client.tsx:51` 硬编码 `chartData={null}`，且详情页 Server Component 未读取 `charts.json`。后端早已生成 `charts.json`（含 5 图表的完整交互 spec），前端也有手写 SVG 的 `InteractiveChart` 组件，但两者未接通。

目标：用 ECharts 替换所有图表渲染，统一交互体验（悬停查值、隐藏曲线、缩放、阈值线、放大），迁移旧运行数据使其也有交互图表。

## 2. 约束

- ECharts 核心包按需 import（控制包体积）
- 自写 React 包装（无 echarts-for-react 第三方封装，避免 React 19 兼容风险）
- Canvas 渲染（飞行日志数据点常达数千，Canvas 性能优于 SVG）
- 5 图表全部 ECharts，按 `chart.id` 分发配置
- 旧运行（无 charts.json）回退 PNG + 提示
- 后端 `charts.json` 数据契约不变（InteractiveChartSpec 结构不动）
- 桌面端 standalone 打包兼容

## 3. ECharts 集成

### 依赖

`package.json` 加 `"echarts": "^5.5.0"`。

### 按需 import

`src/features/charts/echarts-setup.ts`——集中注册需要的模块：

```
echarts/core + LineChart + BarChart + GridComponent + TooltipComponent +
LegendComponent + DataZoomComponent + MarkLineComponent + TitleComponent + CanvasRenderer
```

### EChart 包装组件

`src/features/charts/echart.tsx`——client component，约 50 行：
- `useRef` 持有 div 和 chart 实例
- `useEffect` 初始化：`echarts.init` + `ResizeObserver` 自适应宽度
- `useEffect` 更新：`setOption(option, { notMerge: true })`
- 卸载时 `ro.disconnect()` + `chart.dispose()`
- props: `option: EChartsOption`、`height?: number`（默认 360）、`className?: string`

## 4. 配置生成器

`src/features/charts/chart-config.ts`——纯函数，把 `InteractiveChartSpec` 转成 `EChartsOption`。

### 通用配置（所有图表）

- `tooltip: { trigger: "axis" }`——悬停显示十字线 + 数值
- `legend: { top: 0 }`——图例可点击隐藏曲线
- `grid: { left: 60, right: 24, top: 40, bottom: 60 }`——绘图区边距
- `dataZoom: [{ type: "inside" }, { type: "slider", bottom: 8 }]`——滚轮缩放 + 底部滑块
- series 颜色取自 spec 的 `series.color`
- `xAxis`/`yAxis` 的 name 取自 spec 的 `xLabel`/`yLabel`

### 按 chart.id 分发

| id | 图表类型 | 特殊配置 |
|---|---|---|
| `attitude` | LineChart | 3 条线（Roll/Pitch/Yaw），smooth: false |
| `vibration` | LineChart | 1 条线，thresholds → markLine（虚线 + 标签） |
| `fft` | BarChart | x 轴 Hz（连续值），柱状无间隙，dataZoom 聚焦低频段 |
| `motors` | LineChart | 最多 8 条电机线，thresholds → markLine（饱和线） |
| `battery` | LineChart | 1-2 条线（电压/电流），双 Y 轴（电压 V 左 / 电流 A 右） |

### thresholds → markLine

```ts
markLine: {
  symbol: "none",
  data: spec.thresholds?.map(t => ({
    yAxis: t.value,
    lineStyle: { color: t.color, type: "dashed" },
    label: { formatter: t.label },
  })),
}
```

### battery 双 Y 轴

检测 series 的 unit：有 "V" 的绑左轴（name: "V"），有 "A" 的绑右轴（name: "A"）。通过 `yAxisIndex` 分配。

## 5. ChartsSection + ChartLightbox 改造

### ChartsSection

`src/features/runs/charts-section.tsx` 改造：
- 优先渲染 ECharts：`chartData?.charts` 有值时，每个 spec 经 `buildChartOption(spec)` 转成 EChartsOption，用 `<EChart>` 渲染
- 无 chartData 时回退 PNG figure + 提示"该运行无交互数据，显示静态图"
- 放大按钮触发 ChartLightbox（传 spec 而非 image url）

### ChartLightbox

`src/features/charts/chart-lightbox.tsx` 改造：
- `ChartLightboxTarget` 类型改为 `{ type: "echart"; chart: InteractiveChartSpec } | { type: "image"; title: string; url: string }`
- echart 类型：用 `<EChart option={buildChartOption(chart)} height={600} />` 渲染
- image 类型：保留 PNG 显示（回退用）

## 6. 详情页接通

### Server Component (`src/app/runs/[runId]/page.tsx`)

读取 `charts.json`（若存在）并传给 client：
```ts
let chartData: RunChartData | null = null;
const chartDataPath = path.resolve(runRoot, "charts.json");
if (existsSync(chartDataPath)) {
  try {
    chartData = JSON.parse(readFileSync(chartDataPath, "utf-8"));
  } catch { /* 损坏则 null */ }
}
```
传给 `<RunDetailClient chartData={chartData} ... />`

### RunDetailClient

`run-detail-client.tsx:51` 从 `chartData={null}` 改为 `chartData={chartData}`，并在 props 中接收 `chartData`。

## 7. 迁移脚本

`backend/tools/migrate_charts.py`：
- 遍历 `runs/` 下每个子目录
- 若目录含 `status.json` 且含 `.ulg` 原始文件，但无 `charts.json`
- 调用 `parse_log(ulg_path)` + `extract_metrics` + `generate_chart_data` 补生成 `charts.json`
- 打印迁移结果：补生成 N 个，跳过 M 个（已有/无原始日志）

## 8. 删除旧组件

- 删除 `src/features/charts/interactive-chart.tsx`（手写 SVG，215 行）
- 保留 `src/features/charts/types.ts`（数据契约不变）

## 9. 文件清单

### 新建
| 文件 | 职责 |
|---|---|
| `src/features/charts/echarts-setup.ts` | ECharts 按需 import + 注册 |
| `src/features/charts/echart.tsx` | EChart React 包装组件 |
| `src/features/charts/chart-config.ts` | InteractiveChartSpec → EChartsOption 纯函数 |
| `backend/tools/migrate_charts.py` | 旧数据迁移脚本 |

### 修改
| 文件 | 改动 |
|---|---|
| `package.json` | 加 echarts 依赖 |
| `src/features/charts/chart-lightbox.tsx` | 改用 EChart 渲染放大态 |
| `src/features/runs/charts-section.tsx` | 改用 EChart 渲染，接通 chartData |
| `src/features/runs/run-detail-client.tsx` | 接收+传递 chartData prop |
| `src/app/runs/[runId]/page.tsx` | 读取 charts.json 传入 |
| `src/features/runs/types.ts` | 确保 RunStatus 含 chartDataUrl（已有） |

### 删除
| 文件 | 原因 |
|---|---|
| `src/features/charts/interactive-chart.tsx` | 被 EChart 替换 |

## 10. 不做的事（YAGNI）

- 不改后端 charts.py 的 spec 结构
- 不加新图表类型（保持现有 5 个）
- 不做图表对比功能
- 不做导出图表为图片
- 不做实时数据流（诊断完成后静态展示）
