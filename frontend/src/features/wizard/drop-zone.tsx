// src/features/wizard/drop-zone.tsx
"use client";

import { useRef, useState } from "react";
import { FileCheck2, UploadCloud, X } from "lucide-react";

import { fileSummary } from "./wizard-utils.mjs";

type DropZoneProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
};

export function DropZone({ file, onChange, accept = ".ulg,.bin" }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileCheck2 className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm">{fileSummary(file)}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition-colors " +
        (dragging ? "border-primary bg-primary/5" : "border-border/60 bg-muted/20 hover:bg-muted/40")
      }
    >
      <UploadCloud className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">拖拽日志到此处</p>
      <p className="text-xs text-muted-foreground">或点击选择文件 · 支持 {accept}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
