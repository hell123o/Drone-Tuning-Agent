# Drone Tuning Agent v0.1

无人机飞行日志诊断助手。输入 PX4 `.ulg` 或 ArduPilot `.bin` 日志，输出 Markdown/PDF 诊断报告、分析图表和 PX4 参数建议文件。

## 项目分层

```text
drone-agent/
  backend/    Python 诊断核心、日志解析、指标提取、规则引擎、PDF/params 生成
  frontend/   Next.js Web UI、上传/轮询/API route、报告和图表展示
  desktop/    Electron 桌面壳与打包配置
```

核心数据流：

```text
飞行日志 -> backend Agent -> 解析器/指标/图表/规则 -> LLM 解释 -> 诊断报告
frontend -> API route -> backend/main.py -> runs/<runId> -> 下载/预览
desktop -> 启动 frontend standalone -> 调用打包后的 backend CLI
```

## 后端安装与 CLI 使用

```bash
cd backend
pip install -e .

# 全面诊断
python main.py flight.log.ulg

# 指定问题
python main.py flight.log.ulg -q "分析 PID 调参效果"

# 基于原始参数文件生成建议 params
python main.py flight.log.ulg -p 1.params

# 指定硬件画像
python main.py flight.log.ulg --hardware config/x760_hardware.json

# 指定 LLM API
python main.py flight.log.ulg \
  --api-base http://192.168.2.158:8310/v1 \
  --api-key not-needed

# 指定输出目录
python main.py flight.log.ulg --output ./my-report
```

## 前端开发

```bash
cd frontend
npm install
npm run dev
```

前端 API 默认使用仓库根目录下的 `backend/`。可通过环境变量覆盖：

```bash
DRONE_AGENT_PROJECT_ROOT=/path/to/drone-agent
DRONE_AGENT_BACKEND_ROOT=/path/to/drone-agent/backend
DRONE_AGENT_RUNS_ROOT=/path/to/runs
```

## 桌面端开发

```bash
cd desktop
npm install
npm run dev
```

桌面端开发模式启动 `frontend/`；打包模式使用 `frontend-standalone` 资源，并通过 `DRONE_AGENT_BACKEND_ROOT` 指向复制到运行目录中的后端 CLI。

## 输出

- `diagnosis.md`：Markdown 诊断报告
- `diagnosis.pdf`：PDF 诊断报告
- `attitude.png`：Roll/Pitch/Yaw 姿态曲线
- `fft.png`：振动 FFT 频谱
- `motors.png`：电机输出曲线
- `vibration.png`：振动时间序列
- `battery.png`：电池状态
- `diagnosis_recommendations.params`：可导入 QGroundControl 的参数建议文件

## 硬件画像

默认加载 `backend/config/x760_hardware.json`，包含 X760 的轴距、重量、17 寸桨、Pixhawk 6C、稳定 PX4 参数和安全调参步长。报告会基于这个画像解释响应慢、低频晃动、重心偏移、电池/电流计等问题，避免把大型载重机按穿越机标准误判。

## 支持格式

- PX4: `.ulg`
- ArduPilot: `.bin`，当前为基础支持
