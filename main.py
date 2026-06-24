"""Drone Tuning Agent v0.1 - 飞行日志诊断助手"""
import argparse
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main():
    parser = argparse.ArgumentParser(description="无人机飞行日志诊断助手")
    parser.add_argument("logfile", help="日志文件路径 (.ulg 或 .bin)")
    parser.add_argument("--question", "-q", default=None,
                        help="用户问题（可选，默认: 全面诊断）")
    parser.add_argument("--params", "-p", default=None,
                        help="可选的 .params 参数文件路径")
    parser.add_argument("--output", "-o", default=None,
                        help="输出目录 (默认: 日志文件同级/diagnosis_output/)")
    parser.add_argument("--hardware", default=None,
                        help="硬件配置文件路径 (.json)，默认使用 config/x760_hardware.json")
    parser.add_argument("--api-base", default=None,
                        help="LLM API base URL")
    parser.add_argument("--api-key", default=None,
                        help="LLM API key")
    parser.add_argument("--model", default=None,
                        help="LLM model name")
    parser.add_argument("--timeout", type=float, default=None,
                        help="LLM request timeout seconds (default: 90)")
    parser.add_argument("--max-tokens", type=int, default=None,
                        help="LLM max output tokens (default: 3000)")
    parser.add_argument("--metadata", default=None,
                        help="测试信息 metadata JSON 文件路径")
    args = parser.parse_args()

    # Resolve defaults
    api_base = args.api_base or os.environ.get("LLM_API_BASE", "http://192.168.2.158:8310/v1")
    api_key = args.api_key or os.environ.get("LLM_API_KEY", "not-needed")
    model = args.model or os.environ.get("LLM_MODEL", None)
    if args.timeout is not None:
        os.environ["LLM_TIMEOUT"] = str(args.timeout)
    if args.max_tokens is not None:
        os.environ["LLM_MAX_TOKENS"] = str(args.max_tokens)

    # Validate log file exists
    if not os.path.exists(args.logfile):
        print(f"错误: 日志文件不存在: {args.logfile}")
        sys.exit(1)

    # Resolve output dir
    if args.output:
        output_dir = args.output
    else:
        output_dir = os.path.join(os.path.dirname(os.path.abspath(args.logfile)),
                                  "drone-agent-output")

    from agent import DroneAgent

    metadata = None
    if args.metadata:
        try:
            with open(args.metadata, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except Exception as exc:
            metadata = {"metadata_error": f"测试信息读取失败: {exc}"}

    agent = DroneAgent(api_base=api_base, api_key=api_key, model=model)
    result = agent.diagnose(
        logfile=args.logfile,
        question=args.question,
        params_file=args.params,
        hardware_file=args.hardware,
        output_dir=output_dir,
        metadata=metadata,
    )

    # Save report
    report_path = os.path.join(result["output_dir"], "diagnosis.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(result["report"])

    # Save PDF report for WebUI/download use. Failure should not block diagnosis.
    pdf_path = os.path.join(result["output_dir"], "diagnosis.pdf")
    try:
        from report_pdf import generate_pdf_report
        generate_pdf_report(report_path, pdf_path)
        result["pdf_file"] = pdf_path
    except Exception as exc:
        result["pdf_error"] = str(exc)

    print()
    print("=" * 70)
    print(result["report"])
    print("=" * 70)
    print()
    print(f"诊断报告已保存: {report_path}")
    if result.get("pdf_file"):
        print(f"PDF报告已保存: {result['pdf_file']}")
    elif result.get("pdf_error"):
        print(f"PDF报告生成失败: {result['pdf_error']}")
    if result.get("charts"):
        print(f"图表已保存到: {result['output_dir']}/")
    if result.get("params_file"):
        print(f"参数文件已保存: {result['params_file']}")


if __name__ == "__main__":
    main()
