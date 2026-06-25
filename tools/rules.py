"""诊断规则引擎：基于指标运行预设规则，生成结构化诊断结论。"""
import numpy as np


# --- 外设健康阈值（保守通用值，偏离才报警；缺数据时不下健康结论） ---
OF_QUALITY_MIN = 100          # PX4 光流 quality 0-255，低于此偏低
OF_INNOV_RATIO_MAX = 1.0      # 光流 EKF 创新比偏高阈值
RANGE_SIGNAL_QUALITY_MIN = 30  # 测距信号质量 0-100
RANGE_GAP_RATIO_MAX = 0.2     # 测距不连续比例 >20% 偏高
RTK_FIX_RATIO_MIN = 0.5       # RTK fixed+float 占比 <50% 偏低
GPS_SATS_MIN = 10             # 卫星数下限
GPS_EPH_MAX_M = 1.0           # 水平精度 (m) 上限
GPS_EPV_MAX_M = 1.5           # 垂直精度 (m) 上限


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
    findings.extend(_check_peripheral_consistency(metrics, params or {}, hardware or {}))
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


# --- params/log 外设一致性检查（declared/configured/observed/healthy 四层，只读不改参数） ---

def _param_present(params: dict, *names) -> bool:
    """params 中是否存在任一指定参数（不要求特定值，仅作弱证据之一）。"""
    return any(n in params for n in names)


def _param_truthy(params: dict, name) -> bool:
    """参数存在且为非零/真值（如 EKF2_OF_CTRL=1）。"""
    val = params.get(name)
    if val is None:
        return False
    try:
        return float(val) != 0.0
    except (TypeError, ValueError):
        return str(val).strip().lower() not in {"", "0", "false", "off", "disabled"}


def _declared(hardware: dict, *, name=None, type_=None) -> bool:
    """profile payloads 中是否声明了该外设（按 name 或 type 匹配）。"""
    for p in hardware.get("payloads", []) or []:
        if name and str(p.get("name", "")).strip().lower() == name.lower():
            return True
        if type_ and str(p.get("type", "")).strip().lower() == type_.lower():
            return True
    return False


def _eval_hflow(metrics, params, hardware):
    issues = []
    declared = _declared(hardware, name="H-Flow", type_="optical_flow")

    of_params = ["EKF2_OF_CTRL", "UAVCAN_SUB_FLOW", "UAVCAN_SUB_RNG", "SENS_FLOW_ROT",
                 "EKF2_OF_POS_X", "EKF2_OF_POS_Y", "EKF2_OF_POS_Z"]
    present = [p for p in of_params if p in params]
    configured = _param_truthy(params, "EKF2_OF_CTRL") or len(present) > 0
    if declared and not _param_truthy(params, "EKF2_OF_CTRL"):
        issues.append("EKF2_OF_CTRL 未启用（光流融合可能未开）")
    missing = [p for p in of_params if p not in params]
    if configured and missing:
        issues.append("缺少光流相关参数: " + ", ".join(missing))

    of = (metrics.get("peripherals", {}) or {}).get("optical_flow", {}) or {}
    observed = (of.get("samples") or 0) > 0
    healthy = None
    if observed:
        healthy = True
        q = of.get("quality_mean")
        if q is not None and q < OF_QUALITY_MIN:
            healthy = False
            issues.append(f"光流质量偏低 (quality_mean={q:.0f} < {OF_QUALITY_MIN})")
    elif declared or configured:
        issues.append("日志中未观测到 optical_flow 数据（检查接线/供电/驱动）")

    issues.append("提示：飞行前确认光流测距质量、地面纹理与光照充足")
    return _peripheral_record(declared, configured, observed, healthy, issues)


def _eval_s30(metrics, params, hardware):
    issues = []
    declared = _declared(hardware, name="S30")

    # S30/RPLIDAR 经 TELEM2 / Onboard MAVLink 接入
    tel2 = any(str(params.get(k, "")).upper().find("TELEM2") >= 0 for k in params
               if str(k).startswith("MAV_") and str(k).endswith("_CONFIG"))
    configured = tel2 or _param_present(params, "SER_TEL2_BAUD") or _param_truthy(params, "MAV_1_CONFIG")
    if declared and not configured:
        issues.append("未发现 TELEM2 / Onboard MAVLink 配置（S30 可能未接入）")

    ds = (metrics.get("peripherals", {}) or {}).get("distance_sensor", {}) or {}
    observed = (ds.get("samples") or 0) > 0
    healthy = None
    if observed:
        healthy = True
        sig = ds.get("signal_quality_mean")
        if sig is not None and sig < RANGE_SIGNAL_QUALITY_MIN:
            healthy = False
            issues.append(f"测距信号质量偏低 (signal_quality_mean={sig:.0f} < {RANGE_SIGNAL_QUALITY_MIN})")
        gap = ds.get("gap_ratio")
        if gap is not None and gap > RANGE_GAP_RATIO_MAX:
            healthy = False
            issues.append(f"测距数据不连续 (gap_ratio={gap:.2f} > {RANGE_GAP_RATIO_MAX})")
    elif declared or configured:
        issues.append("日志中未观测到 distance_sensor / OBSTACLE_DISTANCE 数据")

    issues.append("提示：前后左右方向映射需地面验证，无法仅凭单次日志判定")
    return _peripheral_record(declared, configured, observed, healthy, issues)


def _eval_rtk(metrics, params, hardware):
    issues = []
    declared = _declared(hardware, name="RTK", type_="gnss")
    configured = _param_present(params, "GPS_1_CONFIG", "GPS_UBX_DYNMODEL", "GPS_1_GNSS", "GPS_YAW_OFFSET")
    if declared and not configured:
        issues.append("未发现 GPS/RTK 相关参数配置")

    gps = (metrics.get("peripherals", {}) or {}).get("gps", {}) or {}
    observed = (gps.get("samples") or 0) > 0
    healthy = None
    if observed:
        healthy = True
        fixed = gps.get("rtk_fixed_ratio") or 0.0
        floatr = gps.get("rtk_float_ratio") or 0.0
        if declared and (fixed + floatr) < RTK_FIX_RATIO_MIN:
            healthy = False
            issues.append(f"RTK fixed+float 占比偏低 ({(fixed + floatr) * 100:.0f}% < {RTK_FIX_RATIO_MIN * 100:.0f}%)")
        sats = gps.get("satellites_used_min")
        if sats is not None and sats < GPS_SATS_MIN:
            healthy = False
            issues.append(f"可用卫星数偏少 (min={sats} < {GPS_SATS_MIN})")
        eph = gps.get("eph_mean")
        if eph is not None and eph > GPS_EPH_MAX_M:
            healthy = False
            issues.append(f"水平精度偏差大 (eph_mean={eph:.2f}m > {GPS_EPH_MAX_M}m)")
        epv = gps.get("epv_mean")
        if epv is not None and epv > GPS_EPV_MAX_M:
            healthy = False
            issues.append(f"垂直精度偏差大 (epv_mean={epv:.2f}m > {GPS_EPV_MAX_M}m)")
    elif declared or configured:
        issues.append("日志中未观测到 GPS 数据")

    issues.append("提示：Position 模式漂移是否改善需对比飞行验证")
    return _peripheral_record(declared, configured, observed, healthy, issues)


def _peripheral_record(declared, configured, observed, healthy, issues):
    return {
        "declared": bool(declared),
        "configured": bool(configured),
        "observed": bool(observed),
        "healthy": healthy,  # True / False / None(无数据未知)
        "issues": issues,
    }


def evaluate_peripherals(metrics: dict, params: dict = None, hardware: dict = None) -> dict:
    """对每个外设做 declared/configured/observed/healthy 四层判断，返回结构化结果。

    供规则引擎生成 findings 与 agent 输出 snapshot 共用。只读，不产生参数修改。
    """
    metrics = metrics or {}
    params = params or {}
    hardware = hardware or {}
    return {
        "hflow_optical_flow": _eval_hflow(metrics, params, hardware),
        "s30_rangefinder": _eval_s30(metrics, params, hardware),
        "rtk_gnss": _eval_rtk(metrics, params, hardware),
    }


def _check_peripheral_consistency(metrics: dict, params: dict = None, hardware: dict = None) -> list:
    """根据四层一致性结果生成 findings（只读，无 param_updates）。

    仅对「已声明 / 已配置 / 已观测」之一为真的外设产出结论，避免对实机不存在的外设误报。
    """
    findings = []
    labels = {
        "hflow_optical_flow": "H-Flow 光流",
        "s30_rangefinder": "S30 测距",
        "rtk_gnss": "RTK",
    }
    evals = evaluate_peripherals(metrics, params, hardware)
    for key, rec in evals.items():
        if not (rec["declared"] or rec["configured"] or rec["observed"]):
            continue  # 实机大概率无此外设，不报
        label = labels[key]
        layers = (f"声明={_yn(rec['declared'])} 配置={_yn(rec['configured'])} "
                  f"观测={_yn(rec['observed'])} 健康={_health_text(rec['healthy'])}")
        # 实质性 issues（排除“提示/需验证”一类）
        substantive = [i for i in rec["issues"] if not i.startswith("提示")]
        inconsistent = (
            (rec["declared"] and not rec["configured"]) or
            (rec["configured"] and not rec["observed"]) or
            (rec["healthy"] is False)
        )
        if inconsistent:
            findings.append({
                "severity": "warning",
                "category": "peripheral",
                "message": f"{label} 一致性存在断层（{layers}）",
                "recommendation": "；".join(rec["issues"]) if rec["issues"] else "核对声明/配置/接线/数据质量",
            })
        else:
            msg = f"{label} 一致性正常（{layers}）"
            findings.append({
                "severity": "info",
                "category": "peripheral",
                "message": msg,
                "recommendation": "；".join(i for i in rec["issues"] if i.startswith("提示")) or None,
            })
    return findings


def _yn(value) -> str:
    return "是" if value else "否"


def _health_text(value) -> str:
    if value is None:
        return "未知"
    return "健康" if value else "异常"


def _as_float(value, default):
    try:
        if value is None:
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)
