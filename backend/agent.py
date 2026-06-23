"""Drone Tuning Agent — 单 Agent 主循环"""

import json
import os
import re
from openai import OpenAI


class DroneAgent:
    """飞行日志诊断 Agent。"""

    def __init__(self, api_base, api_key, model=None):
        self.api_base = self._normalize_api_base(api_base)
        self.client = OpenAI(
            base_url=self.api_base,
            api_key=api_key,
            timeout=float(os.environ.get("LLM_TIMEOUT", "90")),
            max_retries=int(os.environ.get("LLM_MAX_RETRIES", "1")),
        )
        self.model = model
        self.max_tokens = int(os.environ.get("LLM_MAX_TOKENS", "8000"))
        self.fallback_max_tokens = int(os.environ.get("LLM_FALLBACK_MAX_TOKENS", "1600"))
        self.continuation_max_rounds = int(os.environ.get("LLM_CONTINUATION_MAX_ROUNDS", "2"))

    def _normalize_api_base(self, api_base):
        """Normalize OpenAI-compatible base URLs.

        Many gateways are entered as https://host only, while the OpenAI SDK
        expects the base URL to include /v1. Without /v1 some gateways hang or
        route to a non-API endpoint and eventually time out.
        """
        base = (api_base or "http://192.168.2.158:8310/v1").strip().rstrip("/")
        if not re.search(r"/v\d+(?:/)?$", base):
            base = f"{base}/v1"
        return base

    def diagnose(self, logfile, question=None, params_file=None, hardware_file=None, output_dir=None, metadata=None):
        """执行完整诊断流程。

        返回: {"report": str, "charts": [paths], "findings": list,
               "output_dir": str, "params_file": str|None}
        """
        from tools.parser import parse_log
        from tools.metrics import extract_metrics
        from tools.charts import generate_charts
        from tools.rules import run_diagnostic_rules

        hardware = self._load_hardware(hardware_file)

        # 解析
        parsed = parse_log(logfile)

        # 指标
        metrics = extract_metrics(parsed)

        # 图表
        if output_dir is None:
            output_dir = os.path.join(
                os.path.dirname(os.path.abspath(logfile)),
                "drone-agent-output"
            )
        chart_paths = generate_charts(parsed, metrics, output_dir)

        # 规则诊断
        params = {}
        if params_file:
            params = self._load_params(params_file)
        findings = run_diagnostic_rules(metrics, params, hardware)

        # LLM 报告
        report = self._generate_report(parsed, metrics, chart_paths, findings, question, params, hardware, metadata)

        # 生成 .params 调参建议文件
        params_file_path = self._generate_params_file(findings, params_file, output_dir)

        return {
            "report": report,
            "charts": chart_paths,
            "findings": findings,
            "output_dir": output_dir,
            "params_file": params_file_path,
        }

    def _generate_report(self, parsed, metrics, charts, findings, question, params, hardware=None, metadata=None):
        """调用 LLM 生成诊断报告。"""
        prompt_dir = os.path.join(os.path.dirname(__file__), "prompts")
        system_prompt = ""
        try:
            with open(os.path.join(prompt_dir, "system.md"), "r", encoding="utf-8") as f:
                system_prompt = f.read()
        except FileNotFoundError:
            system_prompt = "你是无人机飞行日志诊断专家。用中文输出 Markdown 诊断报告。"

        # Build user message
        parts = []

        metadata_md = self._format_metadata_markdown(metadata)
        if metadata_md:
            parts.append(metadata_md)

        # Log metadata
        fs = metrics.get("flight_summary", {})
        parts.append(f"## 日志信息\n- 格式: {parsed.get('format', 'unknown')} ({parsed.get('firmware', 'unknown')})\n- 时长: {fs.get('duration_s', 0):.1f}s\n- 飞行模式切换: {fs.get('flight_mode_changes', 0)} 次\n- 数据集: {fs.get('datasets_count', 0)} 个 (含数据: {fs.get('data_with_content', 0)})")

        # Parameters
        kp = fs.get("key_parameters", {})
        parts.append(f"## 关键参数\n```json\n{json.dumps(kp, indent=2, ensure_ascii=False, default=str)}\n```")

        # Hardware context
        if hardware:
            parts.append(f"## 硬件画像\n```json\n{json.dumps(hardware, indent=2, ensure_ascii=False, default=str)}\n```")

        # Metrics
        # Exclude flight_summary from metrics to avoid duplication
        metrics_for_llm = {k: v for k, v in metrics.items() if k != "flight_summary"}
        parts.append(f"## 提取指标\n```json\n{json.dumps(metrics_for_llm, indent=2, ensure_ascii=False, default=str)}\n```")

        # Charts
        parts.append(f"## 生成的图表 ({len(charts)} 张)\n" + "\n".join(f"- {os.path.basename(c)}" for c in charts))

        # Findings
        parts.append(f"## 规则诊断 ({len(findings)} 条)\n" + "\n".join(
            f"- [{f['severity'].upper()}] {f['category']}: {f['message']}" for f in findings
        ))

        # Structured parameter updates
        updates = self._collect_param_updates(findings)
        if updates:
            parts.append(f"## 建议写入参数文件的结构化参数\n```json\n{json.dumps(updates, indent=2, ensure_ascii=False, default=str)}\n```")

        # User question
        if question:
            parts.insert(0, f"## 用户问题\n{question}\n")

        user_message = "\n\n".join(parts)
        compact_first = os.environ.get("LLM_COMPACT_PROMPT", "").lower() in {"1", "true", "yes"} or "codemax.store" in self.api_base
        initial_message = self._build_compact_user_message(parsed, metrics, findings, question, hardware, metadata_md) if compact_first else user_message
        initial_max_tokens = self.fallback_max_tokens if compact_first else self.max_tokens

        try:
            response = self._call_llm(system_prompt, initial_message, initial_max_tokens)
            llm_report = self._collect_llm_report(system_prompt, initial_message, response, initial_max_tokens)
            if metadata_md and "## 测试信息" not in llm_report[:500]:
                return metadata_md + "\n\n" + llm_report
            return llm_report
        except Exception as e:
            first_error = e
            try:
                compact_message = self._build_compact_user_message(parsed, metrics, findings, question, hardware, metadata_md)
                response = self._call_llm(system_prompt, compact_message, self.fallback_max_tokens)
                llm_report = self._collect_llm_report(system_prompt, compact_message, response, self.fallback_max_tokens)
                retry_note = f"\n\n> 注：首次 LLM 调用失败（{first_error}），已自动使用压缩输入重试成功。"
                if metadata_md and "## 测试信息" not in llm_report[:500]:
                    return metadata_md + "\n\n" + llm_report + retry_note
                return llm_report + retry_note
            except Exception as retry_error:
                e = retry_error
            prefix = metadata_md + "\n\n" if metadata_md else ""
            return (
                f"{prefix}LLM 调用失败: {e}\n"
                f"首次错误: {first_error}\n\n"
                f"已使用规则引擎降级生成报告。当前 LLM API Base: {self.api_base}。"
                "如果你输入的是 https://api.xxx.store，程序会自动补成 https://api.xxx.store/v1；"
                "如仍失败，请确认模型名、Key 有效性、服务可用性，或把 LLM_TIMEOUT 调到 180。\n\n"
                f"以下是规则诊断结果：\n\n{self._rule_only_report(parsed, metrics, findings)}"
            )

    def _call_llm(self, system_prompt, user_message, max_tokens):
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        return self.client.chat.completions.create(
            model=self.model or "default",
            messages=messages,
            temperature=0.3,
            max_tokens=max_tokens,
        )

    def _collect_llm_report(self, system_prompt, user_message, response, max_tokens):
        """Collect the initial LLM response and continue if the model hit the token limit."""
        fragments = [self._response_content(response)]
        finish_reason = self._finish_reason(response)
        rounds = 0

        while finish_reason == "length" and rounds < self.continuation_max_rounds:
            rounds += 1
            continuation_prompt = (
                "上一段报告因为输出长度限制被截断。请从上一句继续写，不要重复已经输出的内容，"
                "继续保持 Markdown 结构，直到完成剩余结论、风险提示和下一步建议。\n\n"
                "已输出内容末尾：\n"
                f"{''.join(fragments)[-1200:]}"
            )
            response = self._call_llm(system_prompt, user_message + "\n\n" + continuation_prompt, max_tokens)
            fragments.append(self._response_content(response))
            finish_reason = self._finish_reason(response)

        report = "\n\n".join(fragment.strip() for fragment in fragments if fragment and fragment.strip())
        if finish_reason == "length":
            report += "\n\n> 注：报告达到模型输出长度上限，已尝试自动续写但仍可能不完整。"
        return report

    def _response_content(self, response):
        try:
            return response.choices[0].message.content or ""
        except (AttributeError, IndexError):
            return ""

    def _finish_reason(self, response):
        try:
            return response.choices[0].finish_reason
        except (AttributeError, IndexError):
            return None

    def _build_compact_user_message(self, parsed, metrics, findings, question, hardware, metadata_md):
        """Build a shorter fallback prompt for slow/overloaded API gateways."""
        fs = metrics.get("flight_summary", {})
        vibration = metrics.get("vibration", {})
        attitude = metrics.get("attitude", {})
        motors = metrics.get("motors", {})
        battery = metrics.get("battery", {})
        updates = self._collect_param_updates(findings)
        parts = []
        if question:
            parts.append(f"## 用户问题\n{question}")
        if metadata_md:
            parts.append(metadata_md)
        parts.append(
            "## 日志摘要\n"
            f"- 格式: {parsed.get('format', 'unknown')} ({parsed.get('firmware', 'unknown')})\n"
            f"- 时长: {fs.get('duration_s', 0):.1f}s\n"
            f"- 硬件: {hardware.get('name', 'unknown') if hardware else 'unknown'}"
        )
        parts.append("## 关键指标\n```json\n" + json.dumps({
            "vibration": vibration,
            "attitude": attitude,
            "motors": motors,
            "battery": battery,
        }, indent=2, ensure_ascii=False, default=str) + "\n```")
        parts.append("## 规则诊断\n" + "\n".join(
            f"- [{f['severity'].upper()}] {f['category']}: {f['message']}" + (f"；建议: {f.get('recommendation')}" if f.get('recommendation') else "")
            for f in findings
        ))
        if updates:
            parts.append("## 建议参数更新\n```json\n" + json.dumps(updates, indent=2, ensure_ascii=False, default=str) + "\n```")
        parts.append("请输出简洁中文 Markdown：结论、原因、风险、下一步测试、参数建议。")
        return "\n\n".join(parts)

    def _format_metadata_markdown(self, metadata):
        """格式化测试信息 metadata 为 Markdown 表格。"""
        if not metadata:
            return ""
        labels = [
            ("testTime", "测试时间"),
            ("testLocation", "测试地点"),
            ("testProject", "测试项目"),
            ("testOperator", "测试人员"),
            ("testAircraft", "测试机型"),
        ]
        rows = []
        for key, label in labels:
            value = metadata.get(key)
            if value is not None and str(value).strip():
                rows.append((label, str(value).strip()))
        if metadata.get("metadata_error"):
            rows.append(("测试信息读取状态", str(metadata["metadata_error"])))
        if not rows:
            return ""
        lines = ["## 测试信息", "", "| 项目 | 内容 |", "|---|---|"]
        for label, value in rows:
            safe_value = value.replace("|", "\\|").replace("\n", " ")
            lines.append(f"| {label} | {safe_value} |")
        return "\n".join(lines)

    def _rule_only_report(self, parsed, metrics, findings):
        """LLM 不可用时的降级报告。"""
        lines = [
            "# 飞行日志诊断报告 (规则引擎模式)",
            "",
            f"## 基本信息",
            f"- 格式: {parsed.get('format')} ({parsed.get('firmware')})",
            f"- 时长: {metrics.get('flight_summary', {}).get('duration_s', 0):.1f}s",
            "",
            f"## 规则诊断发现 ({len(findings)} 条)",
        ]
        for f in findings:
            lines.append(f"- **[{f['severity'].upper()}]** {f['category']}: {f['message']}")
            if f.get("recommendation"):
                lines.append(f"  - 建议: {f['recommendation']}")

        return "\n".join(lines)

    def _generate_params_file(self, findings, base_params_path, output_dir):
        """根据规则引擎的结构化建议生成 .params 文件。"""
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "diagnosis_recommendations.params")
        updates = self._collect_param_updates(findings)
        if not updates:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write("# Drone Tuning Agent - 本次未生成参数修改建议\n")
                f.write("# 当前诊断更适合先处理硬件、校准或继续采集日志。\n")
            return output_path

        if base_params_path and os.path.exists(base_params_path):
            lines, seen = self._merge_params_file(base_params_path, updates)
        else:
            lines, seen = self._minimal_params_file(updates), set(updates)

        missing = [name for name in updates if name not in seen]
        if missing:
            lines.append("\n# Added by Drone Tuning Agent\n")
            for name in missing:
                lines.append(self._format_px4_param_line(name, updates[name]))

        with open(output_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return output_path

    def _collect_param_updates(self, findings):
        """汇总规则结论中的 param_updates，后面的规则覆盖前面的同名参数。"""
        updates = {}
        for finding in findings:
            for name, value in finding.get("param_updates", {}).items():
                updates[name] = value
        return updates

    def _merge_params_file(self, base_params_path, updates):
        """保留原始 .params 全量内容，只替换建议参数。"""
        lines = []
        seen = set()
        with open(base_params_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                stripped = line.strip()
                parts = stripped.split("\t")
                if len(parts) >= 5 and parts[2] in updates:
                    parts[3] = self._format_param_value(updates[parts[2]])
                    line = "\t".join(parts) + "\n"
                    seen.add(parts[2])
                elif len(parts) >= 2 and parts[0] in updates and not stripped.startswith("#"):
                    parts[1] = self._format_param_value(updates[parts[0]])
                    line = "\t".join(parts) + "\n"
                    seen.add(parts[0])
                lines.append(line)
        return lines, seen

    def _minimal_params_file(self, updates):
        """没有基准参数文件时，输出 PX4/QGC 可识别的最小参数文件。"""
        lines = [
            "# Drone Tuning Agent - 调参建议文件\n",
            "# 建议基于原始 .params 使用 -p 参数生成全量合并文件；本文件只包含建议修改项。\n",
            "\n",
        ]
        for name, value in updates.items():
            lines.append(self._format_px4_param_line(name, value))
        return lines

    def _format_px4_param_line(self, name, value):
        param_type = 6 if isinstance(value, int) and not isinstance(value, bool) else 9
        return f"1\t1\t{name}\t{self._format_param_value(value)}\t{param_type}\n"

    def _format_param_value(self, value):
        if isinstance(value, float):
            return f"{value:.6g}"
        return str(value)

    def _load_hardware(self, path=None):
        """加载硬件配置。默认读取 config/x760_hardware.json。"""
        if path is None:
            path = os.path.join(os.path.dirname(__file__), "config", "x760_hardware.json")
        if not path or not os.path.exists(path):
            return {}
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _load_params(self, path):
        """加载 .params 文件。"""
        params = {}
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 4:
                    try:
                        params[parts[2]] = float(parts[3])
                    except (ValueError, TypeError):
                        params[parts[2]] = parts[3]
        return params
