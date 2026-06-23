import Link from "next/link";
import { Activity, CheckCircle2, Loader2, Radar, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type AppHeaderProps = {
  loading: boolean;
  hasResult: boolean;
  progress: number;
};

export function AppHeader({ loading, hasResult, progress }: AppHeaderProps) {
  const status = loading
    ? { label: "诊断运行中", icon: Loader2, tone: "text-primary" }
    : hasResult
      ? { label: "报告已生成", icon: CheckCircle2, tone: "text-emerald-700" }
      : { label: "等待输入", icon: Activity, tone: "text-muted-foreground" };
  const StatusIcon = status.icon;

  return (
    <header className="overflow-hidden rounded-2xl border bg-white/90 shadow-sm">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Radar className="size-6" />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                X760 硬件画像
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white px-3 py-1">
                PX4 / ArduPilot 日志诊断
              </Badge>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Drone Tuning Agent</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                面向飞控调参场景的诊断工作台。上传飞行日志，补充现场信息，生成报告、图表和可导入的 PX4 参数建议。
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[360px]">
          <div className="rounded-xl border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">当前状态</span>
              <span className={`flex items-center gap-1.5 font-medium ${status.tone}`}>
                <StatusIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
                {status.label}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
          </div>
          <Link
            href="/latest"
            className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <ShieldCheck className="size-4 text-primary" />
            最近报告
          </Link>
        </div>
      </div>
    </header>
  );
}
