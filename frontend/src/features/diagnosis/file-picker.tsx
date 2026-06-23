import { FileUp, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

import { fileSummary } from "./client-utils.mjs";

type FilePickerProps = {
  id: string;
  name: string;
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
};

export function FilePicker({ id, name, label, hint, accept, file, onChange }: FilePickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {accept.replaceAll(",", " / ")}
        </span>
      </div>
      <label
        htmlFor={id}
        className={cn(
          "group flex cursor-pointer items-start gap-3 rounded-xl border border-dashed bg-white/70 p-4 transition",
          "hover:border-primary/50 hover:bg-white focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15",
          file ? "border-primary/50 bg-primary/5" : "border-border",
        )}
      >
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {file ? <FileUp className="size-5" /> : <UploadCloud className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{file ? fileSummary(file) : "选择文件或拖入后点击"}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{file ? hint : hint}</span>
        </span>
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>
    </div>
  );
}
