"""诊断规则引擎：基于指标运行预设规则，生成结构化诊断结论。"""
import numpy as np


def run_diagnostic_rules(metrics: dict, params: dict = None, hardware: dict = None) -> list:
    """运行诊断规则，返回结论列表。

    每条结论: {"severity": "critical|warning|info", "category": "...",
               "message": "...", "recommendation": "... (optional)"}
    """
    findings = []
    findings.extend(_check_vibration(metrics))
    findings.extend(_check_attitude(metrics, params or {}, hardware or {}))
    findings.extend(_check_motors(metrics))
    findings.extend(_check_battery(metrics))
    findings.extend(_check_pid(metrics, params or {}, hardware or {}))
    findings.extend(_check_parameters(params, metrics, hardware or {}))
    findings.extend(_check_hardware_context(metrics, hardware or {}))
    return findings


# ---------- 振动规则 ----------

def _check_vibration(m: dict) -> list:
    findings = []
    vib = m.get("vibration", {})
    rms = vib.get("vibration_rms_ms2", 0)
    mx = vib.get("vibration_max_ms2", 0)

    if rms < 8:
        findings.append({"severity": "info", "category": "vibration",
                         "message": f"振动正常 (RMS={rms:.1f} m/s², max={mx:.1f} m/s²)"})
    elif rms < 15:
        findings.append({"severity": "warning", "category": "vibration",
                         "message": f"振动偏高 (RMS={rms:.1f} m/s²)，检查桨叶平衡和机架紧固",
                         "recommendation": "检查螺旋桨是否有裂纹/变形，检查电机座是否紧固"})
    else:
        findings.append({"severity": "critical", "category": "vibration",
                         "message": f"振动过高 (RMS={rms:.1f} m/s²)，PID调参无效，先处理振动",
                         "recommendation": "检查桨叶→电机→ESC→机架，逐级排查"})

    # FFT 主导频率
    fpeak = vib.get("fft_peak_hz", 0)
    if fpeak > 0:
        if 80 < fpeak < 120:
            findings.append({"severity": "warning", "category": "vibration",
                             "message": f"主导振动频率 {fpeak:.0f}Hz，可能是桨叶共振，尝试更换桨叶"})
        elif fpeak < 20:
            findings.append({"severity": "warning", "category": "vibration",
                             "message": f"低频振动 {fpeak:.0f}Hz，可能是机架松动或重心偏移"})

    return findings


# ---------- 姿态规则 ----------

def _check_attitude(m: dict, params: dict = None, hardware: dict = None) -> list:
    findings = []
    params = params or {}
    hardware = hardware or {}
    limits = hardware.get("safe_adjustment_limits", {})
    att = m.get("attitude", {})
    roll_std = att.get("roll_std_deg", 0)
    pitch_std = att.get("pitch_std_deg", 0)
    yaw_drift = att.get("yaw_drift_rate_dps", 0)
    roll_bias = att.get("hover_roll_bias_deg", 0)
    pitch_bias = att.get("hover_pitch_bias_deg", 0)

    if roll_std > 5.0:
        findings.append({"severity": "critical", "category": "attitude",
                         "message": f"Roll标准差 {roll_std:.1f}°，严重震荡，MC_ROLL_P可能过高",
                         "recommendation": "降低MC_ROLL_P 0.5，重新飞行测试"})
    elif roll_std > 3.0:
        findings.append({"severity": "warning", "category": "attitude",
                         "message": f"Roll标准差 {roll_std:.1f}°，超出安全范围(3°)，检查MC_ROLL_P"})

    if pitch_std > 5.0:
        findings.append({"severity": "critical", "category": "attitude",
                         "message": f"Pitch标准差 {pitch_std:.1f}°，严重震荡"})
    elif pitch_std > 3.0:
        findings.append({"severity": "warning", "category": "attitude",
                         "message": f"Pitch标准差 {pitch_std:.1f}°，超出安全范围(3°)"})

    if yaw_drift > 2.0:
        current_yaw_p = _as_float(params.get("MC_YAWRATE_P"), 0.20)
        yaw_step = _as_float(limits.get("yaw_rate_p_step"), 0.05)
        target_yaw_p = round(min(current_yaw_p + yaw_step, 0.30), 3)
        findings.append({"severity": "warning", "category": "attitude",
                         "message": f"偏航漂移 {yaw_drift:.1f}°/s，检查IMU校准和MC_YAW_P",
                         "recommendation": f"先执行磁力计/陀螺仪校准；如校准后仍漂移，将 MC_YAWRATE_P 小步调整到 {target_yaw_p}",
                         "param_updates": {"MC_YAWRATE_P": target_yaw_p}})

    if abs(roll_bias) > 1.0:
        trim_limit = _as_float(limits.get("trim_max_rad"), 0.05)
        roll_trim = round(float(np.clip(np.radians(-roll_bias), -trim_limit, trim_limit)), 6)
        findings.append({"severity": "info", "category": "attitude",
                         "message": f"悬停roll偏斜 {roll_bias:+.1f}°，检查重心位置",
                         "recommendation": f"优先检查载荷/重心和水平校准；如需临时补偿，可将 MC_ROLL_TRIM 调到 {roll_trim}",
                         "param_updates": {"MC_ROLL_TRIM": roll_trim}})

    if abs(pitch_bias) > 1.0:
        trim_limit = _as_float(limits.get("trim_max_rad"), 0.05)
        pitch_trim = round(float(np.clip(np.radians(-pitch_bias), -trim_limit, trim_limit)), 6)
        findings.append({"severity": "info", "category": "attitude",
                         "message": f"悬停pitch偏斜 {pitch_bias:+.1f}°，检查重心位置",
                         "recommendation": f"优先检查前后重心和加速度计校准；如需临时补偿，可将 MC_PITCH_TRIM 调到 {pitch_trim}",
                         "param_updates": {"MC_PITCH_TRIM": pitch_trim}})

    return findings


# ---------- 电机规则 ----------

def _check_motors(m: dict) -> list:
    findings = []
    mot = m.get("motors", {})

    for k, v in mot.items():
        if not k.endswith("_jumps"):
            continue
        motor_id = k.replace("_jumps", "")
        count = int(v) if isinstance(v, (int, float)) else 0

        if count > 30:
            findings.append({"severity": "critical", "category": "motor",
                             "message": f"{motor_id} 异常跳变 {count} 次，可能电机/ESC/连线故障",
                             "recommendation": f"检查{motor_id}的电机连线、ESC焊接点"})
        elif count > 10:
            findings.append({"severity": "warning", "category": "motor",
                             "message": f"{motor_id} 异常跳变 {count} 次，建议检查"})

    sat = mot.get("saturation_count", 0)
    if sat > 20:
        findings.append({"severity": "warning", "category": "motor",
                         "message": f"电机饱和 {sat} 次，动力不足或P太高",
                         "recommendation": "检查电机KV/桨叶匹配，或降低P参数"})

    # Motor balance check
    means = mot.get("output_mean", [])
    if len(means) >= 4:
        std = float(np.std(means))
        mean_val = float(np.mean(means))
        if mean_val > 0 and std / mean_val > 0.05:
            findings.append({"severity": "info", "category": "motor",
                             "message": f"电机输出不均衡 (CV={std/mean_val:.1%})，检查电机/桨匹配"})

    return findings


# ---------- 电池规则 ----------

def _check_battery(m: dict) -> list:
    findings = []
    bat = m.get("battery", {})

    if bat.get("low_voltage_warnings", 0) > 0:
        findings.append({"severity": "warning", "category": "battery",
                         "message": f"低电压警告 {bat['low_voltage_warnings']} 次"})
    if bat.get("critical_voltage_warnings", 0) > 0:
        findings.append({"severity": "critical", "category": "battery",
                         "message": f"临界电压警告 {bat['critical_voltage_warnings']} 次"})
    if bat.get("current_avg_A", 0) == 0:
        findings.append({"severity": "warning", "category": "battery",
                         "message": "电流计读数始终为0，耗电统计不可信"})

    # Voltage drop analysis
    drop = bat.get("voltage_drop_V", 0)
    start_v = bat.get("voltage_start_V", 0)
    if start_v > 0 and drop > 2.0:
        pct = drop / start_v * 100
        if pct > 10:
            findings.append({"severity": "warning", "category": "battery",
                             "message": f"电压跌落 {drop:.1f}V ({pct:.0f}%)，检查电池健康和接线",
                             "recommendation": "飞行前测量电池开路电压，检查电池老化"})

    return findings


# ---------- PID规则 ----------

def _check_pid(m: dict, params: dict = None, hardware: dict = None) -> list:
    findings = []
    params = params or {}
    hardware = hardware or {}
    limits = hardware.get("safe_adjustment_limits", {})
    pid = m.get("pid_response", {})

    overshoot = pid.get("roll_overshoot_pct", 0)
    if overshoot > 25:
        current = _as_float(params.get("MC_ROLL_P"), hardware.get("stable_px4_profile", {}).get("MC_ROLL_P", 6.0))
        step = _as_float(limits.get("angle_p_step"), 0.5)
        target = round(max(current - step, 3.0), 3)
        findings.append({"severity": "warning", "category": "pid",
                         "message": f"Roll超调 {overshoot:.0f}%，P可能过高或D太低",
                         "recommendation": f"先将 MC_ROLL_P 小步降到 {target}，或在确认P不过高后微增D项",
                         "param_updates": {"MC_ROLL_P": target}})
    elif overshoot > 15:
        findings.append({"severity": "info", "category": "pid",
                         "message": f"Roll超调 {overshoot:.0f}%，略有震荡倾向"})

    settle = pid.get("settling_time_s", 0)
    if settle > 1.0 and settle > 0:
        findings.append({"severity": "info", "category": "pid",
                         "message": f"恢复时间 {settle:.1f}s，响应偏慢，可适当增加P"})

    sse = pid.get("steady_state_error_deg", 0)
    if sse > 3.0:
        current_i = _as_float(params.get("MC_ROLLRATE_I"), hardware.get("stable_px4_profile", {}).get("MC_ROLLRATE_I", 0.12))
        step_i = _as_float(limits.get("rate_i_step"), 0.02)
        target_i = round(min(current_i + step_i, 0.18), 3)
        findings.append({"severity": "warning", "category": "pid",
                         "message": f"稳态误差 {sse:.1f}°，I项可能不足",
                         "recommendation": f"适当增加 MC_ROLLRATE_I 到 {target_i}",
                         "param_updates": {"MC_ROLLRATE_I": target_i}})

    return findings


# ---------- 参数规则 ----------

def _check_parameters(params: dict, metrics: dict, hardware: dict = None) -> list:
    findings = []
    if not params:
        return findings
    hardware = hardware or {}
    stable = hardware.get("stable_px4_profile", {})

    # Filter cutoff check
    gyro_cutoff = params.get("IMU_GYRO_CUTOFF")
    if gyro_cutoff is not None:
        if gyro_cutoff < 30:
            target = stable.get("IMU_GYRO_CUTOFF", 30)
            findings.append({"severity": "warning", "category": "parameters",
                             "message": f"IMU_GYRO_CUTOFF={gyro_cutoff}，偏低（建议≥30），可能滤掉控制响应",
                             "recommendation": f"提高到 {target}-40（前提是振动<15 m/s²）",
                             "param_updates": {"IMU_GYRO_CUTOFF": target}})
        elif gyro_cutoff > 60:
            findings.append({"severity": "warning", "category": "parameters",
                             "message": f"IMU_GYRO_CUTOFF={gyro_cutoff}，偏高，可能引入噪声",
                             "recommendation": "降低到30-40"})

    dgyro_cutoff = params.get("IMU_DGYRO_CUTOFF")
    if dgyro_cutoff is not None and dgyro_cutoff < 20:
        target = stable.get("IMU_DGYRO_CUTOFF", 25)
        findings.append({"severity": "info", "category": "parameters",
                         "message": f"IMU_DGYRO_CUTOFF={dgyro_cutoff}，偏低（建议≥20）",
                         "recommendation": f"提高到 {target}",
                         "param_updates": {"IMU_DGYRO_CUTOFF": target}})

    # Angle P check
    roll_p = params.get("MC_ROLL_P") or params.get("ATC_RAT_RLL_P")
    if roll_p is not None:
        if isinstance(roll_p, (int, float)):
            if roll_p < 3.0:
                findings.append({"severity": "info", "category": "parameters",
                                 "message": f"MC_ROLL_P={roll_p:.1f}，偏保守，可适当提高"})
            elif roll_p > 7.0:
                findings.append({"severity": "warning", "category": "parameters",
                                 "message": f"MC_ROLL_P={roll_p:.1f}，偏高，注意震荡"})

    # Rate P check
    rate_p = params.get("MC_ROLLRATE_P")
    if rate_p is not None and isinstance(rate_p, (int, float)):
        if rate_p < 0.05:
            findings.append({"severity": "info", "category": "parameters",
                             "message": f"MC_ROLLRATE_P={rate_p:.3f}，偏低，响应可能迟钝"})

    # Yaw rate check
    yaw_rate_p = params.get("MC_YAWRATE_P")
    if yaw_rate_p is not None and isinstance(yaw_rate_p, (int, float)):
        if yaw_rate_p < 0.15:
            findings.append({"severity": "info", "category": "parameters",
                             "message": f"MC_YAWRATE_P={yaw_rate_p:.3f}，偏低（17寸桨建议≥0.20）"})

    # Cross-check: vibration vs gyro cutoff
    vib_rms = metrics.get("vibration", {}).get("vibration_rms_ms2", 0)
    if gyro_cutoff is not None and gyro_cutoff < 40 and vib_rms < 15:
        target = stable.get("IMU_GYRO_CUTOFF", 30)
        findings.append({"severity": "info", "category": "parameters",
                         "message": f"振动 {vib_rms:.1f} m/s² 但 IMU_GYRO_CUTOFF={gyro_cutoff}，可以安全提高",
                         "recommendation": f"振动安全，建议先提高到 {target}，后续再逐步验证是否需要40",
                         "param_updates": {"IMU_GYRO_CUTOFF": target}})

    return findings


def _check_hardware_context(metrics: dict, hardware: dict) -> list:
    findings = []
    if not hardware:
        findings.append({"severity": "info", "category": "hardware",
                         "message": "未提供硬件配置，诊断只能按通用无人机阈值判断",
                         "recommendation": "使用 --hardware 指定机型配置文件，或采用默认 config/x760_hardware.json"})
        return findings

    name = hardware.get("name", "unknown drone")
    prop = hardware.get("propeller_inch")
    weight = hardware.get("typical_takeoff_weight_kg") or hardware.get("max_takeoff_weight_kg")
    goal = hardware.get("tuning_goal")
    message = f"已加载硬件画像: {name}"
    details = []
    if prop:
        details.append(f"{prop}寸桨")
    if weight:
        details.append(f"典型/参考起飞重量约{weight}kg")
    if details:
        message += "（" + "，".join(details) + "）"
    recommendation = goal or "按当前机型目标解释日志，不追求过度灵敏。"
    findings.append({"severity": "info", "category": "hardware",
                     "message": message,
                     "recommendation": recommendation})
    return findings


def _as_float(value, default):
    try:
        if value is None:
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)
