import { ChevronDown, Loader2, Plane, Settings2, Sparkles, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FilePicker } from "./file-picker";
import { ProgressStatus } from "./progress-status";
import type { DiagnosisRunState } from "./types";

type DiagnosisFormProps = {
  diagnosis: DiagnosisRunState;
};

function SectionTitle({ index, title, description }: { index: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
        {index}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FlowSummary() {
  const steps = ["上传日志", "描述现象", "生成报告"];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border bg-white p-2 text-center text-xs">
      {steps.map((step, index) => (
        <div key={step} className="rounded-lg bg-blue-50 px-2 py-2 text-blue-900">
          <span className="mr-1 font-mono text-[11px] text-blue-600">{index + 1}</span>
          {step}
        </div>
      ))}
    </div>
  );
}

export function DiagnosisForm({ diagnosis }: DiagnosisFormProps) {
  return (
    <Card className="h-fit bg-white/95 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plane className="size-5 text-primary" /> 诊断控制台
        </CardTitle>
        <CardDescription>按 3 步完成诊断。新手只需要上传日志并点击开始；高级路径和 LLM 设置可按需展开。</CardDescription>
        <FlowSummary />
      </CardHeader>
      <CardContent className="pt-5">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void diagnosis.startDiagnose();
          }}
        >
          <section className="space-y-4">
            <SectionTitle index="1" title="上传飞行数据" description="日志文件是必填项，参数文件用于生成更完整的调参建议。" />
            <FilePicker
              id="logfileUpload"
              name="logfileUpload"
              label="飞行日志文件"
              hint="支持 PX4 .ulg 和 ArduPilot .bin。局域网设备选择本地文件后会上传到本机分析。"
              accept=".ulg,.bin"
              file={diagnosis.logUpload}
              onChange={diagnosis.setLogUpload}
            />
            <FilePicker
              id="paramsUpload"
              name="paramsUpload"
              label="原始参数文件"
              hint="可选。提供后会基于原参数生成全量合并 params；不提供也会生成最小建议文件。"
              accept=".params,.txt"
              file={diagnosis.paramsUpload}
              onChange={diagnosis.setParamsUpload}
            />
            <details className="group rounded-xl border bg-muted/20 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Settings2 className="size-4 text-primary" />
                  使用服务器本机路径
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="logfile">日志路径</Label>
                  <Input
                    id="logfile"
                    name="logfile"
                    value={diagnosis.logfile}
                    onChange={(event) => diagnosis.setLogfile(event.target.value)}
                    placeholder="例如 D:\\...\\log.ulg 或 /mnt/d/.../log.ulg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="params">参数路径</Label>
                  <Input
                    id="params"
                    name="paramsFile"
                    value={diagnosis.paramsFile}
                    onChange={(event) => diagnosis.setParamsFile(event.target.value)}
                    placeholder="例如 D:\\...\\vehicle.params 或 /mnt/d/.../vehicle.params"
                  />
                </div>
              </div>
            </details>
          </section>

          <section className="space-y-4 border-t pt-5">
            <SectionTitle index="2" title="补充测试背景" description="这些信息会写入报告开头，方便后续复盘和对比。" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="testTime">测试时间</Label>
                <Input id="testTime" name="testTime" value={diagnosis.testTime} onChange={(event) => diagnosis.setTestTime(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="testAircraft">测试机型</Label>
                <Input
                  id="testAircraft"
                  name="testAircraft"
                  value={diagnosis.testAircraft}
                  onChange={(event) => diagnosis.setTestAircraft(event.target.value)}
                  placeholder="例如 X760"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="testLocation">测试地点</Label>
                <Input
                  id="testLocation"
                  name="testLocation"
                  value={diagnosis.testLocation}
                  onChange={(event) => diagnosis.setTestLocation(event.target.value)}
                  placeholder="例如 低空测试场"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="testOperator">测试人员</Label>
                <Input
                  id="testOperator"
                  name="testOperator"
                  value={diagnosis.testOperator}
                  onChange={(event) => diagnosis.setTestOperator(event.target.value)}
                  placeholder="例如 XJX"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="testProject">测试项目</Label>
              <Input
                id="testProject"
                name="testProject"
                value={diagnosis.testProject}
                onChange={(event) => diagnosis.setTestProject(event.target.value)}
                placeholder="例如 X760 悬停稳定性测试"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question">现场现象</Label>
              <Textarea
                id="question"
                name="question"
                value={diagnosis.question}
                onChange={(event) => diagnosis.setQuestion(event.target.value)}
                rows={5}
                placeholder="例如：Position 模式低空悬停会缓慢画圈，松杆仍漂移，不像高频抖动..."
              />
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <details className="group rounded-xl border bg-muted/20 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <UploadCloud className="size-4 text-primary" />
                  LLM 连接设置
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="apiBase">API Base</Label>
                  <Input
                    id="apiBase"
                    name="apiBase"
                    value={diagnosis.apiBase}
                    onChange={(event) => diagnosis.setApiBase(event.target.value)}
                    placeholder="例如 http://192.168.2.158:8310/v1 或 https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    name="apiKey"
                    type="password"
                    value={diagnosis.apiKey}
                    onChange={(event) => diagnosis.setApiKey(event.target.value)}
                    placeholder="本地无鉴权服务可留空"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model">模型名称</Label>
                  <Input
                    id="model"
                    name="model"
                    value={diagnosis.model}
                    onChange={(event) => diagnosis.setModel(event.target.value)}
                    placeholder="留空使用服务端默认模型"
                  />
                </div>
              </div>
            </details>
          </section>

          <div className="space-y-3 border-t pt-5">
            <Button type="submit" size="lg" className="h-11 w-full gap-2 text-base" disabled={diagnosis.loading}>
              {diagnosis.loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              开始诊断
            </Button>
            <ProgressStatus clientStatus={diagnosis.clientStatus} progress={diagnosis.progress} activeRunId={diagnosis.activeRunId} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
