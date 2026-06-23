import { Radar } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 p-8 text-center text-muted-foreground">
      <div className="flex size-12 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
        <Radar className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="max-w-md text-sm leading-6">{description}</p>
      </div>
    </div>
  );
}
