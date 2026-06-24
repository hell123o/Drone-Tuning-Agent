"""迁移脚本：为缺少 charts.json 的旧运行目录补生成交互图表数据。

用法: python tools/migrate_charts.py [--runs-dir ../runs]
"""
import argparse
import os
import sys
import glob

# Windows 控制台默认 GBK 编码，无法输出 ✓/✗ 等 Unicode 字符，强制 UTF-8
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

# 确保能 import backend 模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def find_log_file(run_dir):
    """在运行目录中查找原始日志文件 (.ulg 或 .bin)。"""
    for pattern in ("*.ulg", "*.bin"):
        matches = glob.glob(os.path.join(run_dir, pattern))
        if matches:
            return matches[0]
    return None


def migrate_runs(runs_dir):
    """扫描 runs 目录，为缺少 charts.json 的运行补生成。"""
    from tools.parser import parse_log
    from tools.metrics import extract_metrics
    from tools.charts import generate_chart_data

    if not os.path.isdir(runs_dir):
        print(f"runs 目录不存在: {runs_dir}")
        return

    migrated = 0
    skipped_existing = 0
    skipped_no_log = 0
    errors = 0

    entries = sorted(os.listdir(runs_dir))
    for name in entries:
        run_dir = os.path.join(runs_dir, name)
        if not os.path.isdir(run_dir):
            continue

        status_file = os.path.join(run_dir, "status.json")
        if not os.path.exists(status_file):
            continue

        charts_file = os.path.join(run_dir, "charts.json")
        if os.path.exists(charts_file):
            skipped_existing += 1
            continue

        log_file = find_log_file(run_dir)
        if not log_file:
            print(f"  跳过 {name}: 无原始日志文件")
            skipped_no_log += 1
            continue

        try:
            print(f"  迁移 {name}...")
            parsed = parse_log(log_file)
            metrics = extract_metrics(parsed)
            generate_chart_data(parsed, metrics, run_dir)
            migrated += 1
            print(f"    ✓ charts.json 已生成")
        except Exception as exc:
            print(f"    ✗ 失败: {exc}")
            errors += 1

    print()
    print("=" * 50)
    print(f"迁移完成: {migrated} 个已生成, {skipped_existing} 个已有跳过, "
          f"{skipped_no_log} 个无日志跳过, {errors} 个失败")


def main():
    parser = argparse.ArgumentParser(description="为旧运行目录补生成 charts.json")
    parser.add_argument("--runs-dir", default=None,
                        help="runs 目录路径 (默认: ../runs 相对 backend)")
    args = parser.parse_args()

    if args.runs_dir:
        runs_dir = args.runs_dir
    else:
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        runs_dir = os.path.join(os.path.dirname(backend_dir), "runs")

    print(f"扫描 runs 目录: {runs_dir}")
    migrate_runs(runs_dir)


if __name__ == "__main__":
    main()
