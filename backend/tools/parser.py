"""日志解析器：支持 PX4 .ulg 和 ArduPilot .bin"""

import os
import numpy as np


def parse_ulg(path: str) -> dict:
    """解析 PX4 .ulg 日志，返回结构化字典。"""
    from pyulog import ULog

    ulog = ULog(path)

    # --- 初始参数 ---
    params = {}
    if hasattr(ulog, "initial_parameters"):
        for pname, pdata in ulog.initial_parameters.items():
            try:
                val = getattr(pdata, "value", pdata)
                params[pname] = float(val)
            except (AttributeError, ValueError, TypeError):
                params[pname] = str(pdata)

    # --- 数据集清单 ---
    datasets = []
    ts_keys_set = {"__timestamp", "timestamp"}
    for d in ulog.data_list:
        fields = []
        length = 0
        if hasattr(d, "data") and d.data:
            fields = list(d.data.keys())
            for fk in fields:
                if fk not in ts_keys_set:
                    arr = d.data[fk]
                    length = len(arr) if hasattr(arr, "__len__") else 0
                    break
        datasets.append({"name": d.name, "fields": fields, "length": length})

    # --- 关键数据集样本 ---
    key_names = [
        "vehicle_attitude",
        "vehicle_attitude_setpoint",
        "vehicle_angular_velocity",
        "sensor_combined",
        "vehicle_local_position",
        "vehicle_local_position_setpoint",
        "vehicle_velocity_world",
        "actuator_controls_0",
        "actuator_motors",
        "battery_status",
        "vehicle_global_position",
        "vehicle_status",
        "manual_control_setpoint",
        "vehicle_attitude_ground_truth",
        "vehicle_air_data",
        "ekf2_innovations",
    ]

    raw_sample = {}
    for name in key_names:
        for d in ulog.data_list:
            if d.name != name or not hasattr(d, "data") or not d.data:
                continue
            non_ts_fields = [f for f in d.data if f not in ts_keys_set]
            if not non_ts_fields:
                continue
            sample = {"fields": list(d.data.keys()), "count": 0}
            arr0 = np.asarray(d.data[non_ts_fields[0]])
            sample["count"] = len(arr0)
            # Store first/last (3 points)
            for fk in non_ts_fields[:4]:
                arr = np.asarray(d.data[fk])
                try:
                    sample[f"first_{fk}"] = arr[:3].tolist()
                    sample[f"last_{fk}"] = arr[-3:].tolist()
                except (TypeError, AttributeError):
                    sample[f"{fk}"] = str(arr)
            # For analysis: uniform subset for large datasets
            max_subset = 500
            if sample["count"] > max_subset:
                indices = np.linspace(0, sample["count"] - 1, max_subset, dtype=int)
                subset = {}
                for fk in non_ts_fields[:8]:
                    try:
                        arr = np.asarray(d.data[fk])
                        subset[fk] = arr[indices].tolist()
                    except (TypeError, AttributeError):
                        pass
                if subset:
                    sample["data_subset"] = subset
            raw_sample[name] = sample
            break

    # --- 飞行模式 ---
    flight_modes = []
    NAV_STATE_MAP = {
        1: "ALTCTL", 2: "POSCTL", 8: "STAB",
        21: "AUTO_MISSION", 22: "AUTO_LOITER", 23: "AUTO_RTL",
        24: "AUTO_LAND", 25: "AUTO_RTGS", 26: "AUTO_HOLD",
        27: "AUTO_takeoff", 41: "RC", 43: "OFFBOARD",
        45: "ACRO", 51: "AUTO_TAKEOFF", 61: "LANDING",
    }
    for d in ulog.data_list:
        if d.name != "vehicle_status" or "nav_state" not in d.data:
            continue
        ts_key = "__timestamp" if "__timestamp" in d.data else "timestamp"
        ts_arr = d.data.get(ts_key)
        nav_arr = np.asarray(d.data["nav_state"])
        if len(nav_arr) == 0:
            break
        if ts_arr is not None:
            ts_arr = np.asarray(ts_arr)
        prev = int(nav_arr[0])
        for i in range(1, len(nav_arr)):
            curr = int(nav_arr[i])
            if curr != prev:
                t = float(ts_arr[i]) / 1e6 if ts_arr is not None else 0.0
                mode_name = NAV_STATE_MAP.get(curr, f"UNKNOWN({curr})")
                flight_modes.append({"mode": mode_name, "time_s": t, "state_id": curr})
                prev = curr
        break

    # --- 时长 ---
    duration_s = 0.0
    if ulog.data_list:
        for d in ulog.data_list:
            if not hasattr(d, "data") or not d.data:
                continue
            ts_key = "__timestamp" if "__timestamp" in d.data else "timestamp"
            if ts_key not in d.data:
                continue
            ts = np.asarray(d.data[ts_key])
            if len(ts) > 1:
                duration_s = float((ts[-1] - ts[0]) / 1e6)
                if duration_s > 0:
                    break

    return {
        "format": "ulg",
        "firmware": "PX4",
        "parameters": params,
        "datasets": datasets,
        "raw_sample": raw_sample,
        "flight_modes": flight_modes,
        "duration_s": duration_s,
    }


def parse_bin(path: str) -> dict:
    """解析 ArduPilot .bin 日志（基础版）。"""
    from pymavlink import mavutil

    mlog = mavutil.mavlink_connection(path, zero_time_base=False)
    messages = {"ATTITUDE": [], "RAW_IMU": [], "MOT": [], "BATT": [], "STAT": [], "SYS": []}
    time_offset = None

    while True:
        msg = mlog.recv_match()
        if msg is None:
            break
        msg_type = msg.get_type()
        if time_offset is None:
            time_offset = msg.get_timestamp()
        t = msg.get_timestamp() - time_offset

        if msg_type == "ATTITUDE":
            messages["ATTITUDE"].append({"time": t, "roll": msg.roll, "pitch": msg.pitch, "yaw": msg.yaw})
        elif msg_type == "RAW_IMU":
            messages["RAW_IMU"].append({"time": t, "xacc": msg.xacc, "yacc": msg.yacc, "zacc": msg.zacc, "gyro_x": msg.gx, "gyro_y": msg.gy, "gyro_z": msg.gz})
        elif msg_type == "MOT":
            messages["MOT"].append({"time": t, "mot": [msg.mot1, msg.mot2, msg.mot3, msg.mot4, msg.mot5, msg.mot6, msg.mot7, msg.mot8]})
        elif msg_type == "BATT":
            messages["BATT"].append({"time": t, "voltage": msg.Volts, "current": msg.Ah})
        elif msg_type == "SYS":
            messages["SYS"].append({"time": t, "type": msg.type, "autopilot": msg.autopilot})
        elif msg_type == "STAT":
            messages["STAT"].append({"time": t, "status": msg.system_status})

    datasets = [{"name": n, "fields": list(v[0].keys()) if v else [], "length": len(v)} for n, v in messages.items() if v]
    all_times = [m["time"] for msgs in messages.values() for m in msgs]
    duration_s = (max(all_times) - min(all_times)) if all_times else 0.0
    raw_sample = {n: {"fields": list(v[0].keys()), "count": len(v), "first3": v[:3], "last3": v[-3:]} for n, v in messages.items() if v}

    return {
        "format": "bin", "firmware": "ArduPilot", "parameters": {},
        "datasets": datasets, "raw_sample": raw_sample,
        "flight_modes": [], "duration_s": duration_s,
    }


def parse_log(path: str) -> dict:
    """统一入口：自动检测格式并解析。"""
    if not os.path.exists(path):
        raise FileNotFoundError(f"日志文件不存在: {path}")
    if path.lower().endswith(".ulg"):
        return parse_ulg(path)
    elif path.lower().endswith(".bin"):
        return parse_bin(path)
    else:
        raise ValueError(f"不支持的日志格式: {path}，请使用 .ulg 或 .bin")
