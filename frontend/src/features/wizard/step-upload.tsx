// src/features/wizard/step-upload.tsx
"use client";

import { ChevronDown, Settings2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { DropZone } from "./drop-zone";
import type { WizardState } from "./use-wizard-state";

export function StepUpload({ wizard }: { wizard: WizardState }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">上传飞行数据</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          日志文件是必填项，参数文件用于生成更完整的调参建议。
        </p>
      </div>

      <DropZone file={wizard.form.logUpload} onChange={wizard.setLogUpload} />

      <details className="group rounded-xl border border-border/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <UploadCloud className="size-4 text-muted-foreground" />
            使用服务器本机路径
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-border/60 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="logfile">日志路径</Label>
            <Input
              id="logfile"
              value={wizard.form.logfile}
              onChange={(e) => wizard.setLogfile(e.target.value)}
              placeholder="例如 D:\\...\\log.ulg 或 /mnt/d/.../log.ulg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paramsPath">参数路径</Label>
            <Input
              id="paramsPath"
              value={wizard.form.paramsFile}
              onChange={(e) => wizard.setParamsFile(e.target.value)}
              placeholder="例如 D:\\...\\vehicle.params"
            />
          </div>
        </div>
      </details>

      <details className="group rounded-xl border border-border/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            高级选项
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-border/60 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="paramsUpload">原始参数文件上传</Label>
            <DropZone
              file={wizard.form.paramsUpload}
              onChange={wizard.setParamsUpload}
              accept=".params,.txt"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apiBase">API Base</Label>
            <Input
              id="apiBase"
              value={wizard.form.apiBase}
              onChange={(e) => wizard.setApiBase(e.target.value)}
              placeholder="例如 http://192.168.2.158:8310/v1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={wizard.form.apiKey}
              onChange={(e) => wizard.setApiKey(e.target.value)}
              placeholder="本地无鉴权服务可留空"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">模型名称</Label>
            <Input
              id="model"
              value={wizard.form.model}
              onChange={(e) => wizard.setModel(e.target.value)}
              placeholder="留空使用服务端默认模型"
            />
          </div>
        </div>
      </details>

      <div className="flex justify-end">
        <Button onClick={wizard.next} disabled={!wizard.canProceed} size="lg">
          下一步
        </Button>
      </div>
    </div>
  );
}
