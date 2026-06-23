"""指标提取器：从解析后的日志数据提取振动、姿态、电机、电池、PID 指标。"""

import json
import numpy as np


def extract_metrics(parsed_log: dict) -> dict:
    """从解析后的日志数据提取指标，返回 JSON-serializable 字典。"""
    metrics = {}
    raw = parsed_log.get("raw_sample", {})
    params = parsed_log.get("parameters", {})

    metrics["vibration"] = _compute_vibration(raw, parsed_log)
    metrics["attitude"] = _compute_attitude(raw, parsed_log)
    metrics["motors"] = _compute_motors(raw, parsed_log)
    metrics["battery"] = _compute_battery(raw)
    metrics["pid_response"] = _compute_pid_response(raw, parsed_log)
    metrics["hover_segments"] = _find_hover_segments(raw, parsed_log)
    metrics["flight_summary"] = _flight_summary(parsed_log)

    return metrics


def _get_subset(raw, dataset, field):
    """从 data_subset 中提取字段数据。优先用采样子集，没有就用首尾。

    PX4 字段名可能是 'accelerometer_m_s2[0]' 而不是 'accelerometer_m_s2'。
    自动探测匹配。
    """
    if dataset not in raw:
        return None
    sample = raw[dataset]
    subset = sample.get("data_subset", {})

    if not subset:
        key = f"first_{field}"
        if key in sample:
            return np.asarray(sample[key], dtype=float)
        return None

    # Try exact match first
    if field in subset:
        return np.asarray(subset[field], dtype=float)

    # Try with [N] suffix: field = 'accelerometer_m_s2' -> look for 'accelerometer_m_s2[0]' etc.
    if "[" not in field:
        prefix = field
        matching = [k for k in subset.keys() if k.startswith(prefix + "[")]
        if matching:
            # Stack matching arrays
            arrays = [np.asarray(subset[k], dtype=float) for k in sorted(matching)]
            stacked = np.stack(arrays, axis=-1)
            return stacked  # shape (N, num_channels)

    return None


def _compute_vibration(raw: dict, parsed_log: dict) -> dict:
    """从 sensor_combined 提取振动指标。优先用 accelerometer，fallback 用 gyro magnitude。"""
    result = {
        "vibration_rms_ms2": 0.0, "vibration_max_ms2": 0.0,
        "fft_peak_hz": 0.0, "fft_peak_magnitude": 0.0,
        "gyro_rms_rads": 0.0,
    }
    duration = max(parsed_log.get("duration_s", 10), 0.1)

    # Try accelerometer first
    accel = _get_subset(raw, "sensor_combined", "accelerometer_m_s2")
    if accel is not None and len(accel) > 10:
        # Shape: (N, 3) or (3, N)
        if accel.ndim == 2:
            if accel.shape[0] == 3:
                accel = accel.T
            mag = np.sqrt(np.sum(accel ** 2, axis=1)) - 9.81
            mag = np.abs(mag)
        else:
            mag = np.abs(accel)
        result["vibration_rms_ms2"] = float(np.sqrt(np.mean(mag ** 2)))
        result["vibration_max_ms2"] = float(np.max(mag))

        # FFT
        if len(mag) > 100:
            fft_vals = np.abs(np.fft.rfft(mag - np.mean(mag)))
            fft_freqs = np.fft.rfftfreq(len(mag), d=1.0 / (len(mag) / duration))
            freq_mask = (fft_freqs > 5) & (fft_freqs < 200)
            if np.any(freq_mask):
                mf = fft_freqs[freq_mask]
                mv = fft_vals[freq_mask]
                pi = np.argmax(mv)
                result["fft_peak_hz"] = float(mf[pi])
                result["fft_peak_magnitude"] = float(mv[pi])

        return result

    # Fallback: use gyro magnitude as vibration proxy
    gyro = _get_subset(raw, "sensor_combined", "gyro_rad")
    if gyro is not None and len(gyro) > 10:
        if gyro.ndim == 2 and gyro.shape[0] == 3:
            gyro = gyro.T
        mag = np.sqrt(np.sum(gyro ** 2, axis=1))
        result["gyro_rms_rads"] = float(np.sqrt(np.mean(mag ** 2)))
        if len(mag) > 100:
            fft_vals = np.abs(np.fft.rfft(mag - np.mean(mag)))
            fft_freqs = np.fft.rfftfreq(len(mag), d=1.0 / (len(mag) / duration))
            freq_mask = (fft_freqs > 5) & (fft_freqs < 200)
            if np.any(freq_mask):
                mf = fft_freqs[freq_mask]
                mv = fft_vals[freq_mask]
                pi = np.argmax(mv)
                result["fft_peak_hz"] = float(mf[pi])
                result["fft_peak_magnitude"] = float(mv[pi])
    return result


def _compute_attitude(raw: dict, parsed_log: dict) -> dict:
    """计算姿态指标。"""
    result = {
        "roll_std_deg": 0.0, "pitch_std_deg": 0.0,
        "max_roll_deg": 0.0, "max_pitch_deg": 0.0,
        "yaw_drift_rate_dps": 0.0,
        "hover_roll_bias_deg": 0.0, "hover_pitch_bias_deg": 0.0,
    }

    q0 = _get_subset(raw, "vehicle_attitude", "q[0]")
    q1 = _get_subset(raw, "vehicle_attitude", "q[1]")
    q2 = _get_subset(raw, "vehicle_attitude", "q[2]")
    q3 = _get_subset(raw, "vehicle_attitude", "q[3]")

    if any(a is None for a in [q0, q1, q2, q3]):
        return result

    roll = np.degrees(np.arctan2(2 * (q0 * q1 + q2 * q3), 1 - 2 * (q1 ** 2 + q2 ** 2)))
    pitch = np.degrees(np.arctan2(2 * (q0 * q2 - q3 * q1), 1 - 2 * (q2 ** 2 + q1 ** 2)))
    yaw = np.degrees(np.arctan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q3 ** 2 + q2 ** 2)))

    result["max_roll_deg"] = float(np.max(np.abs(roll)))
    result["max_pitch_deg"] = float(np.max(np.abs(pitch)))

    # Angular velocity for hover detection
    av0 = _get_subset(raw, "vehicle_angular_velocity", "xyz[0]")
    av1 = _get_subset(raw, "vehicle_angular_velocity", "xyz[1]")
    av2 = _get_subset(raw, "vehicle_angular_velocity", "xyz[2]")

    if av0 is not None:
        threshold = np.degrees(5.0 / 3600)
        hover_mask = np.abs(av0) < threshold
        if av1 is not None:
            hover_mask &= np.abs(av1) < threshold
        if av2 is not None:
            hover_mask &= np.abs(av2) < threshold
    else:
        hover_mask = (np.abs(roll) < 3.0) & (np.abs(pitch) < 3.0)

    hover_count = int(np.sum(hover_mask))
    if hover_count > 0:
        hr = roll[hover_mask]
        hp = pitch[hover_mask]
        result["roll_std_deg"] = float(np.std(hr))
        result["pitch_std_deg"] = float(np.std(hp))
        result["hover_roll_bias_deg"] = float(np.mean(hr))
        result["hover_pitch_bias_deg"] = float(np.mean(hp))
        if len(yaw[hover_mask]) > 1:
            result["yaw_drift_rate_dps"] = float(np.std(yaw[hover_mask]))

    return result


def _compute_motors(raw: dict, parsed_log: dict) -> dict:
    """计算电机指标。"""
    result = {"saturation_count": 0, "abnormal_jumps": {}, "output_mean": []}
    mot = _get_subset(raw, "actuator_motors", "control")
    if mot is None or len(mot) == 0:
        return result

    if mot.ndim == 2:
        saturated = np.max(np.abs(mot), axis=1) > 0.95
        result["saturation_count"] = int(np.sum(saturated))

        num_motors = min(8, mot.shape[1])
        for m_idx in range(num_motors):
            ctrl = mot[:, m_idx]
            diff = np.abs(np.diff(ctrl))
            jumps = int(np.sum(diff > 0.15))
            result[f"motor_{m_idx}_jumps"] = jumps

        hover_mask = np.std(mot[:, :4], axis=1) < 0.02
        if np.sum(hover_mask) > 10:
            hm = mot[hover_mask][:, :4]
            result["output_mean"] = [float(np.mean(hm[:, i])) for i in range(4)]
    else:
        result["saturation_count"] = int(np.sum(np.abs(mot) > 0.95))

    return result


def _compute_battery(raw: dict) -> dict:
    """计算电池指标。"""
    bat = _get_subset(raw, "battery_status", "voltage_v")
    result = {
        "voltage_start_V": 0.0, "voltage_end_V": 0.0, "voltage_drop_V": 0.0,
        "current_avg_A": 0.0, "discharged_mah": 0.0,
        "low_voltage_warnings": 0, "critical_voltage_warnings": 0,
    }
    if bat is None or len(bat) == 0:
        return result

    result["voltage_start_V"] = float(bat[0])
    result["voltage_end_V"] = float(bat[-1])
    result["voltage_drop_V"] = float(bat[0] - bat[-1])

    # Current
    for curr_field in ["current_a_sensors_average", "current_a"]:
        curr = _get_subset(raw, "battery_status", curr_field)
        if curr is not None and len(curr) > 0:
            result["current_avg_A"] = float(np.mean(np.abs(curr)))
            break

    # Discharged
    disc = _get_subset(raw, "battery_status", "discharged_mah")
    if disc is not None and len(disc) > 0:
        result["discharged_mah"] = float(disc[-1])

    # Flags
    flags = _get_subset(raw, "battery_status", "flag")
    if flags is not None and len(flags) > 0:
        for f in flags:
            f = int(f)
            if f & (1 << 6):
                result["low_voltage_warnings"] += 1
            if f & (1 << 7):
                result["critical_voltage_warnings"] += 1
            if f & (1 << 8):
                result["critical_voltage_warnings"] += 1

    return result


def _compute_pid_response(raw: dict, parsed_log: dict) -> dict:
    """计算PID响应指标。"""
    result = {
        "roll_overshoot_pct": 0.0, "settling_time_s": 0.0,
        "steady_state_error_deg": 0.0,
    }

    sp = _get_subset(raw, "vehicle_attitude_setpoint", "roll_body")
    q0 = _get_subset(raw, "vehicle_attitude", "q[0]")
    q1 = _get_subset(raw, "vehicle_attitude", "q[1]")
    q2 = _get_subset(raw, "vehicle_attitude", "q[2]")
    q3 = _get_subset(raw, "vehicle_attitude", "q[3]")

    if sp is None or q0 is None:
        return result

    # Convert setpoint to Euler roll
    if len(sp) < 20:
        return result
    sp_deg = np.degrees(sp) if np.max(np.abs(sp)) < 1 else sp

    # Convert actual to Euler roll
    if q1 is not None and q2 is not None and q3 is not None:
        min_len = min(len(sp_deg), len(q0))
        actual_roll = np.degrees(np.arctan2(
            2 * (q0[:min_len] * q1[:min_len] + q2[:min_len] * q3[:min_len]),
            1 - 2 * (q1[:min_len] ** 2 + q2[:min_len] ** 2)))
    else:
        actual_roll = sp_deg  # fallback

    duration = max(parsed_log.get("duration_s", 10), 0.1)
    n = len(sp_deg)
    sample_time = duration / n

    # Find step changes
    sp_diff = np.abs(np.diff(sp_deg))
    step_idxs = np.where(sp_diff > 10)[0]
    if len(step_idxs) == 0:
        return result

    idx = step_idxs[0]
    setpoint_val = sp_deg[idx + 1]
    initial_val = np.mean(actual_roll[max(0, idx - 10):idx])
    step_size = abs(setpoint_val - initial_val)
    if step_size < 1:
        return result

    # Overshoot
    end = min(idx + 100, n)
    overshoot = float(np.max(actual_roll[idx:end]) - setpoint_val)
    result["roll_overshoot_pct"] = float(overshoot / step_size * 100)

    # Settling
    error = actual_roll[idx:end] - setpoint_val
    settle = np.where(np.abs(error) < 2.0)[0]
    if len(settle) > 0:
        result["settling_time_s"] = float((idx + settle[0]) * sample_time)
    if len(error) > 10:
        result["steady_state_error_deg"] = float(np.mean(np.abs(error[-10:])))

    return result


def _find_hover_segments(raw: dict, parsed_log: dict) -> list:
    """找出悬停时间段 [(start_time, end_time), ...]。"""
    segments = []
    av0 = _get_subset(raw, "vehicle_angular_velocity", "xyz[0]")
    if av0 is None:
        return segments

    av1 = _get_subset(raw, "vehicle_angular_velocity", "xyz[1]")
    av2 = _get_subset(raw, "vehicle_angular_velocity", "xyz[2]")

    threshold = np.degrees(5.0 / 3600)
    mask = np.abs(av0) < threshold
    if av1 is not None:
        mask &= np.abs(av1) < threshold
    if av2 is not None:
        mask &= np.abs(av2) < threshold

    if not np.any(mask):
        return segments

    transitions = np.diff(mask.astype(int))
    starts = np.where(transitions == 1)[0] + 1
    ends = np.where(transitions == -1)[0] + 1

    if len(starts) > len(ends):
        ends = np.append(ends, len(mask))
    elif len(ends) > len(starts):
        starts = np.insert(starts, 0, 0)

    duration = max(parsed_log.get("duration_s", 10), 0.1)
    sample_time = duration / len(mask)

    for s, e in zip(starts, ends):
        if e - s > 10:
            segments.append([float(s * sample_time), float(e * sample_time)])

    return segments


def _flight_summary(parsed_log: dict) -> dict:
    """飞行摘要信息。"""
    return {
        "format": parsed_log.get("format", "unknown"),
        "firmware": parsed_log.get("firmware", "unknown"),
        "duration_s": round(parsed_log.get("duration_s", 0), 1),
        "datasets_count": len(parsed_log.get("datasets", [])),
        "data_with_content": len([d for d in parsed_log.get("datasets", []) if d.get("length", 0) > 0]),
        "flight_mode_changes": len(parsed_log.get("flight_modes", [])),
        "key_parameters": {
            k: parsed_log.get("parameters", {}).get(k)
            for k in ["MC_ROLL_P", "MC_PITCH_P", "MC_ROLLRATE_P", "MC_ROLLRATE_I", "MC_ROLLRATE_D",
                       "MC_YAWRATE_P", "MC_YAWRATE_I", "MC_YAWRATE_D",
                       "IMU_GYRO_CUTOFF", "IMU_DGYRO_CUTOFF", "IMU_ACCEL_CUTOFF"]
        },
    }
