const METADATA_LABELS: [string, string][] = [
  ["testTime", "测试时间"],
  ["testLocation", "测试地点"],
  ["testProject", "测试项目"],
  ["testOperator", "测试人员"],
  ["testAircraft", "测试机型"],
];

type RunMetadataProps = {
  metadata?: Record<string, string>;
};

export function RunMetadata({ metadata }: RunMetadataProps) {
  const rows = METADATA_LABELS.map(([key, label]) => [label, metadata?.[key]] as const).filter(([, value]) =>
    value?.trim(),
  );

  if (!rows.length) {
    return null;
  }

  return (
    <section className="rounded-xl border bg-muted/25 p-4">
      <h2 className="mb-3 text-lg font-semibold">测试信息</h2>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
            <span className="min-w-0">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
