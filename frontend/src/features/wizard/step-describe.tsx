// src/features/wizard/step-describe.tsx
"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { WizardState } from "./use-wizard-state";

type StepDescribeProps = { wizard: WizardState; onExplicitStart: () => void };

export function StepDescribe({ wizard, onExplicitStart }: StepDescribeProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">现场描述</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          这次飞行发生了什么？描述越详细，诊断越准确。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="question">现象描述</Label>
        <Textarea
          id="question"
          value={wizard.form.question}
          onChange={(e) => wizard.setQuestion(e.target.value)}
          rows={6}
          placeholder="例如：Position 模式低空悬停会缓慢画圈，松杆仍漂移，不像高频抖动..."
        />
      </div>

      <details className="group rounded-xl border border-border/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
          <span>补充测试背景（时间/地点/人员）</span>
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-border/60 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="testTime">测试时间</Label>
            <Input id="testTime" value={wizard.form.testTime} onChange={(e) => wizard.setTestTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testAircraft">测试机型</Label>
            <Input id="testAircraft" value={wizard.form.testAircraft} onChange={(e) => wizard.setTestAircraft(e.target.value)} placeholder="例如 X760" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testLocation">测试地点</Label>
            <Input id="testLocation" value={wizard.form.testLocation} onChange={(e) => wizard.setTestLocation(e.target.value)} placeholder="例如 低空测试场" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testOperator">测试人员</Label>
            <Input id="testOperator" value={wizard.form.testOperator} onChange={(e) => wizard.setTestOperator(e.target.value)} placeholder="例如 XJX" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="testProject">测试项目</Label>
            <Input id="testProject" value={wizard.form.testProject} onChange={(e) => wizard.setTestProject(e.target.value)} placeholder="例如 X760 悬停稳定性测试" />
          </div>
        </div>
      </details>

      <div className="flex justify-between">
        <Button variant="outline" onClick={wizard.prev}>
          上一步
        </Button>
        <Button onClick={onExplicitStart} size="lg">
          开始诊断
        </Button>
      </div>
    </div>
  );
}
