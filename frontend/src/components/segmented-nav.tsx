"use client";

import { cn } from "@/lib/utils";

export type SegmentedNavItem = {
  value: string;
  label: string;
};

type SegmentedNavProps = {
  items: SegmentedNavItem[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedNav({ items, value, onChange }: SegmentedNavProps) {
  return (
    <nav className="flex items-center gap-6 border-b border-border/60">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "-mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors",
            value === item.value
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
