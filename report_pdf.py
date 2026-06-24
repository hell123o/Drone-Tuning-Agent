"""Generate a simple PDF report from diagnosis markdown without external PDF deps.

Uses matplotlib's built-in PDF backend, already required by chart generation.
"""
from __future__ import annotations

import os
import re
import textwrap
from typing import Iterable


def _clean_markdown(line: str) -> str:
    line = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", line)
    line = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", line)
    line = line.replace("**", "").replace("__", "").replace("`", "")
    line = line.replace("# ", "").replace("## ", "").replace("### ", "")
    return line.rstrip()


def _wrapped_lines(markdown_text: str, width: int = 92) -> Iterable[str]:
    for raw in markdown_text.splitlines():
        line = _clean_markdown(raw)
        if not line:
            yield ""
            continue
        indent = "  " if line.startswith("  ") else ""
        chunks = textwrap.wrap(line.strip(), width=width, replace_whitespace=False) or [""]
        for chunk in chunks:
            yield indent + chunk


def generate_pdf_report(markdown_path: str, output_path: str) -> str:
    """Render diagnosis markdown into a readable multi-page PDF."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages
    from matplotlib import font_manager

    with open(markdown_path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()

    # Prefer Chinese-capable fonts on Windows, fall back gracefully.
    preferred = ["Microsoft YaHei", "SimHei", "Noto Sans CJK SC", "Arial Unicode MS", "DejaVu Sans"]
    available = {font.name for font in font_manager.fontManager.ttflist}
    font_name = next((name for name in preferred if name in available), "DejaVu Sans")
    plt.rcParams["font.sans-serif"] = [font_name]
    plt.rcParams["axes.unicode_minus"] = False

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    lines = list(_wrapped_lines(text))
    lines_per_page = 46

    with PdfPages(output_path) as pdf:
        for page_start in range(0, max(len(lines), 1), lines_per_page):
            page_lines = lines[page_start : page_start + lines_per_page]
            fig = plt.figure(figsize=(8.27, 11.69))  # A4 portrait
            fig.patch.set_facecolor("white")
            ax = fig.add_axes([0, 0, 1, 1])
            ax.axis("off")
            ax.text(
                0.06,
                0.96,
                "Drone Tuning Agent 诊断报告",
                fontsize=16,
                fontweight="bold",
                va="top",
                color="#111111",
            )
            y = 0.91
            for line in page_lines:
                ax.text(0.06, y, line, fontsize=9.5, va="top", color="#222222")
                y -= 0.0185 if line else 0.014
            ax.text(0.94, 0.03, f"Page {page_start // lines_per_page + 1}", fontsize=8, ha="right", color="#666666")
            pdf.savefig(fig)
            plt.close(fig)

    return output_path
