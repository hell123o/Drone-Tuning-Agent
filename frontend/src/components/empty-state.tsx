import { Radar } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-muted-foreground">
      <div className="flex size-10 items-center justify-center rounded-lg bg-background text-muted-foreground">
        <Radar className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="max-w-md text-sm leading-6">{description}</p>
      </div>
    </div>
  );
}
