# Drone Tuning Agent v0.1

无人机飞行日志诊断助手 — 输入 `.ulg`/`.bin` 日志，输出 Markdown 诊断报告、图表和调参建议。

## 架构

```
飞行日志 → Agent → [解析器/指标/图表/规则] → LLM 解释 → 诊断报告
```

## 安装

```bash
cd drone-agent
pip install -e .
```

## 使用

```bash
# 基础用法：全面诊断
python main.py flight.log.ulg

# 指定问题
python main.py flight.log.ulg -q "分析PID调参效果"

# 指定参数文件
python main.py flight.log.ulg -p 1.params

# 使用默认 X760 硬件画像，并基于原始参数文件输出调参后的 .params
python main.py flight.log.ulg -p 1.params

# 列出/查看硬件画像
python main.py --list-profiles
python main.py --view-profile x760_hflow_s30

# 为本次诊断选择硬件画像
python main.py flight.log.ulg --profile x760_hflow_s30_rtk

# 指定其他硬件画像
python main.py flight.log.ulg --hardware config/x760_hardware.json

# 指定 LLM API
python main.py flight.log.ulg \
    --api-base http://192.168.2.158:8310/v1 \
    --api-key not-needed

# 指定输出目录
python main.py flight.log.ulg --output ./my-report
```

## 输出

- `diagnosis.md` — Markdown 诊断报告
- `attitude.png` — 姿态曲线 (Roll/Pitch/Yaw)
- `fft.png` — FFT 频谱 (振动分析)
- `motors.png` — 电机输出曲线
- `vibration.png` — 振动时间序列
- `battery.png` — 电池状态
- `diagnosis_recommendations.params` — 调参建议文件

## 硬件画像

默认会加载 `config/x760_hardware.json`，包含 X760 的轴距、重量、17寸桨、Pixhawk 6C、稳定 PX4 参数和安全调参步长。报告会基于这个画像解释“响应慢、低频晃动、重心偏移、电池/电流计”等问题，避免把大型载重机按穿越机标准误判。

如需换机型，复制该 JSON 后修改字段，并通过 `--hardware your_drone.json` 指定。

## 参数文件生成

程序会从规则引擎的结构化建议生成 `diagnosis_recommendations.params`：

- 如果提供 `-p 原始.params`，会保留原文件全量内容，只替换建议修改项，缺失参数会追加到文件末尾。
- 如果没有提供 `-p`，会生成只包含建议修改项的最小 PX4/QGC 参数文件。
- 如果本次更适合先处理硬件/校准而不是改参数，文件会明确写明“本次未生成参数修改建议”。

## LLM 配置

```bash
# 环境变量（可选，已有默认值）
export LLM_API_BASE=http://192.168.2.158:8310/v1
export LLM_API_KEY=not-needed
export LLM_MODEL=your-model-name
```

## 支持格式

- PX4: `.ulg` (完整支持)
- ArduPilot: `.bin` (基础版)

## 诊断指标

- **振动分析**: RMS、峰值、FFT 主导频率
- **姿态分析**: 悬停稳定性、roll/pitch 标准差、偏航漂移、姿态偏斜
- **电机分析**: 均衡性、异常跳变、饱和情况
- **电池分析**: 电压跌落、电流、低电压警告
- **PID 响应**: 超调、恢复时间、稳态误差
- **悬停段检测**: 自动识别稳定悬停时间段

## 规则引擎

预定义诊断规则：
- 振动 >15 m/s² 时标记为高风险
- 姿态偏斜 >1° 提示重心/IMU 问题
- 电机跳变 >30 次标记为异常
- 电池低电压警告计数
- 滤波器设置评价

如有问题可以联系我：
QQ：2099016592
