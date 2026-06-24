"""图表生成器：生成姿态曲线、FFT 频谱、电机输出、振动、电池状态图表。"""

import os
import numpy as np

def _init_matplotlib():
    """初始化 matplotlib Agg 后端。"""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({
        "figure.dpi": 150,
        "savefig.dpi": 150,
        "font.size": 8,
        "axes.titlesize": 10,
        "axes.labelsize": 9,
    })
    return plt


def generate_charts(parsed_log: dict, metrics: dict, output_dir: str) -> list:
    """生成所有图表，返回 PNG 文件路径列表。"""
    os.makedirs(output_dir, exist_ok=True)
    raw = parsed_log.get("raw_sample", {})
    charts = []

    charts.append(_plot_attitude(raw, output_dir))
    charts.append(_plot_fft(raw, parsed_log, output_dir))
    charts.append(_plot_motors(raw, parsed_log, output_dir))
    charts.append(_plot_vibration(raw, parsed_log, output_dir))
    charts.append(_plot_battery(raw, output_dir))

    # Filter existing files
    return [c for c in charts if os.path.exists(c)]


def _get_chart_data(dataset_dict, field):
    """从 data_subset dict 中提取数据，支持 prefix 匹配。"""
    if not dataset_dict:
        return None
    if field in dataset_dict:
        return dataset_dict[field]
    if "[" not in field:
        matching = [k for k in dataset_dict.keys() if k.startswith(field + "[")]
        if matching:
            return {k: dataset_dict[k] for k in sorted(matching)}
    return None


def _plot_attitude(raw: dict, output_dir: str) -> str:
    """姿态曲线图: roll/pitch/yaw vs time"""
    plt = _init_matplotlib()

    att = raw.get("vehicle_attitude", {}).get("data_subset", {})
    q0 = _get_chart_data(att, "q[0]")
    q1 = _get_chart_data(att, "q[1]")
    q2 = _get_chart_data(att, "q[2]")
    q3 = _get_chart_data(att, "q[3]")

    if not all(a is not None for a in [q0, q1, q2, q3]):
        return ""

    q0, q1, q2, q3 = [np.asarray(a, dtype=float) for a in [q0, q1, q2, q3]]
    roll = np.degrees(np.arctan2(2 * (q0 * q1 + q2 * q3), 1 - 2 * (q1 ** 2 + q2 ** 2)))
    pitch = np.degrees(np.arctan2(2 * (q0 * q2 - q3 * q1), 1 - 2 * (q2 ** 2 + q1 ** 2)))
    yaw = np.degrees(np.arctan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q3 ** 2 + q2 ** 2)))

    t = np.arange(len(roll))
    plt.figure(figsize=(14, 6))
    plt.subplot(3, 1, 1)
    plt.plot(t, roll, linewidth=0.5, color="#2196F3")
    plt.axhline(y=0, color="gray", linestyle="--", linewidth=0.5)
    plt.ylabel("Roll (°)")
    plt.legend(["Roll"])
    plt.grid(True, alpha=0.3)

    plt.subplot(3, 1, 2)
    plt.plot(t, pitch, linewidth=0.5, color="#4CAF50")
    plt.axhline(y=0, color="gray", linestyle="--", linewidth=0.5)
    plt.ylabel("Pitch (°)")
    plt.legend(["Pitch"])
    plt.grid(True, alpha=0.3)

    plt.subplot(3, 1, 3)
    plt.plot(t, yaw, linewidth=0.5, color="#F44336")
    plt.ylabel("Yaw (°)")
    plt.xlabel("Sample index")
    plt.legend(["Yaw"])
    plt.grid(True, alpha=0.3)

    plt.suptitle("Attitude (Roll/Pitch/Yaw)")
    plt.tight_layout()
    path = os.path.join(output_dir, "attitude.png")
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    return path


def _plot_fft(raw: dict, parsed_log: dict, output_dir: str) -> str:
    """振动 FFT 频谱图"""
    plt = _init_matplotlib()

    sc = raw.get("sensor_combined", {}).get("data_subset", {})
    accel_data = _get_chart_data(sc, "accelerometer_m_s2")
    if accel_data:
        accel = [np.asarray(accel_data[k], dtype=float) for k in sorted(accel_data.keys())]
        if len(accel) == 3:
            data = np.stack(accel, axis=-1)
        else:
            return ""
        title = "Accelerometer Vibration FFT"
        is_accel = True
    else:
        gyro_data = _get_chart_data(sc, "gyro_rad")
        if not gyro_data:
            return ""
        gyro = [np.asarray(gyro_data[k], dtype=float) for k in sorted(gyro_data.keys())]
        if len(gyro) == 3:
            data = np.stack(gyro, axis=-1)
        else:
            return ""
        title = "Gyro Magnitude FFT"
        is_accel = False

    duration = max(parsed_log.get("duration_s", 10), 0.1)
    n = len(data)
    sr = n / duration

    mag = np.sqrt(np.sum(data ** 2, axis=1))
    if is_accel:
        mag = mag - 9.81  # subtract gravity
        mag = np.abs(mag)

    fft_vals = np.abs(np.fft.rfft(mag - np.mean(mag)))
    fft_freqs = np.fft.rfftfreq(n, d=1.0 / sr)

    plt.figure(figsize=(12, 4))
    plt.plot(fft_freqs, fft_vals, linewidth=0.5, color="#2196F3")
    plt.xlabel("Frequency (Hz)")
    plt.ylabel("Magnitude")
    plt.title(title)
    plt.xlim(0, 200)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    path = os.path.join(output_dir, "fft.png")
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    return path


def _plot_motors(raw: dict, parsed_log: dict, output_dir: str) -> str:
    """电机输出 vs time"""
    plt = _init_matplotlib()

    ctrl = raw.get("actuator_motors", {}).get("data_subset", {})
    if not ctrl:
        return ""

    # Find control channels
    control_keys = sorted([k for k in ctrl.keys() if k.startswith("control[")])
    if not control_keys:
        return ""

    t = np.arange(len(next(v for v in ctrl.values())))
    colors = ["#F44336", "#FF9800", "#4CAF50", "#2196F3"]
    labels = [f"Motor {i}" for i in range(len(control_keys))]

    plt.figure(figsize=(14, 4))
    for i, key in enumerate(control_keys[:4]):
        arr = np.asarray(ctrl[key], dtype=float)
        plt.plot(t, arr, linewidth=0.5, color=colors[i % 4], label=labels[i])
    plt.axhline(y=1.0, color="red", linestyle="--", linewidth=1, label="Saturation")
    plt.axhline(y=0.0, color="gray", linestyle="--", linewidth=0.5)
    plt.ylabel("Control output (0-1)")
    plt.xlabel("Sample index")
    plt.title("Motor Control Outputs")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    path = os.path.join(output_dir, "motors.png")
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    return path


def _plot_vibration(raw: dict, parsed_log: dict, output_dir: str) -> str:
    """振动时间序列 + 阈值线"""
    plt = _init_matplotlib()

    sc = raw.get("sensor_combined", {}).get("data_subset", {})
    accel_data = _get_chart_data(sc, "accelerometer_m_s2")
    if not accel_data:
        return ""
    accel = [np.asarray(accel_data[k], dtype=float) for k in sorted(accel_data.keys())]
    if len(accel) != 3:
        return ""

    data = np.stack(accel, axis=-1)
    mag = np.abs(np.sqrt(np.sum(data ** 2, axis=1)) - 9.81)

    t = np.arange(len(mag))
    plt.figure(figsize=(14, 4))
    plt.plot(t, mag, linewidth=0.5, color="#FF5722")
    plt.axhline(y=8, color="green", linestyle="--", linewidth=1, label="Normal (<8 m/s²)")
    plt.axhline(y=15, color="orange", linestyle="--", linewidth=1, label="Caution (<15 m/s²)")
    plt.axhline(y=30, color="red", linestyle="--", linewidth=1, label="Critical (>30 m/s²)")
    plt.ylabel("Vibration magnitude (m/s²)")
    plt.xlabel("Sample index")
    plt.title("Vibration Time Series")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    path = os.path.join(output_dir, "vibration.png")
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    return path


def _plot_battery(raw: dict, output_dir: str) -> str:
    """电池状态图"""
    plt = _init_matplotlib()

    volt = raw.get("battery_status", {}).get("data_subset", {}).get("voltage_v")
    curr = raw.get("battery_status", {}).get("data_subset", {}).get("current_a_sensors_average") or \
           raw.get("battery_status", {}).get("data_subset", {}).get("current_a")

    if volt is None:
        return ""

    volt = np.asarray(volt, dtype=float)
    t = np.arange(len(volt))

    plt.figure(figsize=(14, 4))
    plt.plot(t, volt, linewidth=0.5, color="#2196F3", label="Voltage (V)")
    if curr is not None:
        curr = np.asarray(curr, dtype=float)
        plt.plot(t, curr, linewidth=0.5, color="#FF9800", label="Current (A)")

    plt.ylabel("Value")
    plt.xlabel("Sample index")
    plt.title("Battery Status")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    path = os.path.join(output_dir, "battery.png")
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    return path
