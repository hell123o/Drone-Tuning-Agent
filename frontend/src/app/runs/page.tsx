import { RunList } from "@/features/runs/run-list";
import type { RunSummary } from "@/features/runs/types";

export default async function RunsPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/runs`, {
    cache: "no-store",
  });
  const data = (await res.json()) as { runs: RunSummary[] };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">运行历史</h1>
        <p className="mt-1 text-sm text-muted-foreground">共 {data.runs.length} 次诊断</p>
      </div>
      <RunList runs={data.runs} />
    </div>
  );
}
