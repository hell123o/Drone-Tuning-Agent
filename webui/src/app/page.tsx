"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  Bot,
  Download,
  FileChartColumn,
  FileSliders,
  Loader2,
  Plane,
  Radar,
  Sparkles,
  Upload,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Chart = {
  name: string;
  url: string;
};

type DiagnoseResult = {
  runId: string;
  outputDir: string;
  stdout: string;
  stderr: string;
  reportUrl: string;
  pdfUrl?: string;
  paramsUrl: string;
  snapshotUrl?: string;
  charts: Chart[];
};

type DiagnoseStatus = Partial<DiagnoseResult> & {
  runId: string;
  state: "uploading" | "running" | "done" | "error";
  step?: string;
  progress?: number;
  error?: string;
  code?: number | null;
  stdoutTail?: string;
  stderrTail?: string;
};

type HardwareProfileSummary = {
  id: string;
  label: string;
  path: string;
  default?: boolean;
  exists?: boolean;
};

type HardwareProfileResponse = {
  profiles: HardwareProfileSummary[];
  defaultProfile?: string;
  selectedProfile?: HardwareProfileSummary & {
    data: Record<string, unknown>;
  };
};

export default function Home() {
  const [logfile, setLogfile] = useState("");
  const [paramsFile, setParamsFile] = useState("");
  const [question, setQuestion] = useState("");
  const [apiBase, setApiBase] = useState("http://192.168.2.158:8310/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [testTime, setTestTime] = useState(() => new Date().toLocaleString("zh-CN", { hour12: false }));
  const [testLocation, setTestLocation] = useState("");
  const [testProject, setTestProject] = useState("");
  const [testOperator, setTestOperator] = useState("");
  const [testAircraft, setTestAircraft] = useState("X760");
  const [takeoffWeightKg, setTakeoffWeightKg] = useState("");
  const [logUpload, setLogUpload] = useState<File | null>(null);
  const [paramsUpload, setParamsUpload] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientStatus, setClientStatus] = useState("页面已加载，等待点击");
  const [progress, setProgress] = useState(0);
  const [activeRunId, setActiveRunId] = useState("");
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [report, setReport] = useState("");
  const [paramsPreview, setParamsPreview] = useState("");
  const [hardwareProfiles, setHardwareProfiles] = useState<HardwareProfileSummary[]>([]);
  const [hardwareProfile, setHardwareProfile] = useState("x760_base");
  const [selectedProfileData, setSelectedProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileError, setProfileError] = useState("");

  const statusLabel = useMemo(() => {
    if (loading) return "诊断运行中";
    if (result) return "已生成报告";
    return "等待输入";
  }, [loading, result]);

  const selectedProfile = useMemo(
    () => hardwareProfiles.find((profile) => profile.id === hardwareProfile),
    [hardwareProfiles, hardwareProfile],
  );

  const selectedProfileJson = useMemo(
    () => (selectedProfileData ? JSON.stringify(selectedProfileData, null, 2) : ""),
    [selectedProfileData],
  );

  useEffect(() => {
    let ignore = false;

    async function loadProfiles() {
      try {
        setProfileError("");
        const response = await fetch(`/api/hardware-profiles?id=${encodeURIComponent(hardwareProfile)}`, { cache: "no-store" });
        const data = (await response.json()) as HardwareProfileResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "无法读取硬件画像");
        if (ignore) return;
        setHardwareProfiles(data.profiles ?? []);
        if (data.selectedProfile) {
          setSelectedProfileData(data.selectedProfile.data);
          setHardwareProfile(data.selectedProfile.id);
        } else if (data.defaultProfile) {
          setHardwareProfile(data.defaultProfile);
        }
      } catch (profileLoadError) {
        if (ignore) return;
        setProfileError(profileLoadError instanceof Error ? profileLoadError.message : String(profileLoadError));
      }
    }

    loadProfiles();
    return () => {
      ignore = true;
    };
  }, [hardwareProfile]);

  async function loadResult(data: DiagnoseResult, statusText = "诊断完成") {
    setResult(data);
    setClientStatus(statusText);
    const [reportText, paramsText] = await Promise.all([
      fetch(data.reportUrl).then((res) => res.text()),
      fetch(data.paramsUrl).then((res) => res.text()),
    ]);
    setReport(reportText);
    setParamsPreview(paramsText);
    setProgress(100);
    setLoading(false);
  }

  async function pollDiagnosis(runId: string) {
    setActiveRunId(runId);
    for (;;) {
      const response = await fetch(`/api/status/${encodeURIComponent(runId)}`, { cache: "no-store" });
      const status = (await response.json()) as DiagnoseStatus;
      if (!response.ok) throw new Error(status.error || "无法读取诊断进度");

      setProgress(status.progress ?? 0);
      setClientStatus(status.step || `诊断状态：${status.state}`);

      if (status.state === "done") {
        await loadResult(status as DiagnoseResult, "诊断完成");
        return;
      }
      if (status.state === "error") {
        setLoading(false);
        setError(`${status.error || status.step || "诊断失败"}\n${status.stderrTail || ""}\n${status.stdoutTail || ""}`.trim());
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
  }

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (loading) return;
      try {
        const response = await fetch("/api/latest", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!data?.runId || data.runId === result?.runId) return;
        await loadResult(data, `已自动载入最近诊断：${data.runId}`);
      } catch {
        // 轮询失败不影响手动诊断。
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loading, result?.runId]);

  async function startDiagnose() {
    setClientStatus(`已点击开始诊断：${new Date().toLocaleTimeString()}`);
    if (!logUpload && !logfile.trim()) {
      setError("请先选择飞行日志文件，或填写服务器本机日志路径。");
      return;
    }

    setLoading(true);
    setClientStatus("正在上传文件并启动诊断...");
    setProgress(5);
    setActiveRunId("");
    setError("");
    setResult(null);
    setReport("");
    setParamsPreview("");

    try {
      const form = new FormData();
      form.set("logfile", logfile);
      form.set("paramsFile", paramsFile);
      form.set("question", question);
      form.set("apiBase", apiBase);
      form.set("apiKey", apiKey);
      form.set("model", model);
      form.set("hardwareProfile", hardwareProfile);
      form.set("testTime", testTime);
      form.set("testLocation", testLocation);
      form.set("testProject", testProject);
      form.set("testOperator", testOperator);
      form.set("testAircraft", testAircraft);
      form.set("takeoffWeightKg", takeoffWeightKg);
      if (logUpload) form.set("logfileUpload", logUpload);
      if (paramsUpload) form.set("paramsUpload", paramsUpload);

      const response = await fetch("/api/diagnose", {
        method: "POST",
        body: form,
      });
      setClientStatus(`服务器已响应：HTTP ${response.status}`);
      const data = await response.json();
      if (!response.ok) {
        setError(`${data.error ?? "诊断失败"}\n${data.stderr ?? ""}\n${data.stdout ?? ""}`.trim());
        return;
      }

      if (response.status === 202 && data.runId) {
        setClientStatus(data.step || "诊断任务已启动，正在轮询进度...");
        setProgress(data.progress ?? 15);
        await pollDiagnosis(data.runId);
        return;
      }

      await loadResult(data, "诊断完成");
    } catch (diagnoseError) {
      setClientStatus("诊断请求失败");
      setError(diagnoseError instanceof Error ? diagnoseError.message : String(diagnoseError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-3xl border bg-card/60 p-6 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1">
                <Radar className="size-3.5" /> X760 Hardware Profile
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                shadcn/ui WebUI
              </Badge>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Drone Tuning Agent
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
                选择飞行日志文件，选填原始参数和现象描述，一键生成诊断报告、图表和可导入的 PX4 params 文件。
              </p>
            </div>
          </div>
          <Card className="min-w-64 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardDescription>当前状态</CardDescription>
              <CardTitle className="flex items-center gap-2 text-xl">
                {loading ? <Loader2 className="size-5 animate-spin" /> : <Activity className="size-5" />}
                {statusLabel}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[460px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plane className="size-5" /> 诊断输入
              </CardTitle>
              <CardDescription>优先使用文件选择；路径输入仅作为本机高级用法。</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                action="/api/diagnose"
                method="post"
                encType="multipart/form-data"
                onSubmit={(event) => {
                  event.preventDefault();
                  void startDiagnose();
                }}
              >
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">测试信息</h3>
                    <p className="mt-1 text-xs text-muted-foreground">这些内容会写入 test_metadata.json，并显示在 Markdown/PDF 诊断报告开头。</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="testTime">测试时间</Label>
                      <Input id="testTime" name="testTime" value={testTime} onChange={(event) => setTestTime(event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="testAircraft">测试机型</Label>
                      <Input id="testAircraft" name="testAircraft" value={testAircraft} onChange={(event) => setTestAircraft(event.target.value)} placeholder="例如 X760" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="takeoffWeightKg">实测起飞重量</Label>
                      <Input id="takeoffWeightKg" name="takeoffWeightKg" value={takeoffWeightKg} onChange={(event) => setTakeoffWeightKg(event.target.value)} placeholder="例如 4.2kg" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="testLocation">测试地点</Label>
                      <Input id="testLocation" name="testLocation" value={testLocation} onChange={(event) => setTestLocation(event.target.value)} placeholder="例如 观澜低空测试场" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="testOperator">测试人员</Label>
                      <Input id="testOperator" name="testOperator" value={testOperator} onChange={(event) => setTestOperator(event.target.value)} placeholder="例如 XJX" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="testProject">测试项目</Label>
                    <Input id="testProject" name="testProject" value={testProject} onChange={(event) => setTestProject(event.target.value)} placeholder="例如 X760 悬停稳定性测试" />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">硬件画像</h3>
                      <p className="mt-1 text-xs text-muted-foreground">选择本次诊断使用的 X760 硬件配置。</p>
                    </div>
                    {selectedProfile?.default && <Badge variant="secondary">默认</Badge>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hardwareProfile">选择硬件画像</Label>
                    <select
                      id="hardwareProfile"
                      name="hardwareProfile"
                      value={hardwareProfile}
                      onChange={(event) => setHardwareProfile(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {hardwareProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {profileError ? (
                    <p className="text-xs text-destructive">{profileError}</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="font-mono">
                          {hardwareProfile}
                        </Badge>
                        {selectedProfile?.path && <span className="font-mono">{selectedProfile.path}</span>}
                      </div>
                      <ScrollArea className="h-40 rounded-lg border bg-black/40 p-3">
                        <pre className="whitespace-pre-wrap text-xs text-emerald-100">
                          {selectedProfileJson || "正在加载硬件画像..."}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>

                <FilePicker
                  id="logfileUpload"
                  name="logfileUpload"
                  label="飞行日志文件（必选）"
                  hint="支持 .ulg / .bin。局域网其他电脑选择自己的文件后会自动上传到本机分析。"
                  accept=".ulg,.bin"
                  file={logUpload}
                  onChange={setLogUpload}
                />

                <div className="space-y-2">
                  <Label htmlFor="logfile">或填写服务器本机日志路径（高级，可不填）</Label>
                  <Input
                    id="logfile"
                    name="logfile"
                    value={logfile}
                    onChange={(event) => setLogfile(event.target.value)}
                    placeholder="例如 D:\\...\\log.ulg 或 /mnt/d/.../log.ulg"
                  />
                </div>

                <Separator />

                <FilePicker
                  id="paramsUpload"
                  name="paramsUpload"
                  label="原始参数文件（选填）"
                  hint="提供后会基于原参数生成全量合并 params；不提供也会生成最小建议文件。"
                  accept=".params,.txt"
                  file={paramsUpload}
                  onChange={setParamsUpload}
                />

                <div className="space-y-2">
                  <Label htmlFor="params">或填写服务器本机参数文件路径（选填）</Label>
                  <Input
                    id="params"
                    name="paramsFile"
                    value={paramsFile}
                    onChange={(event) => setParamsFile(event.target.value)}
                    placeholder="例如 D:\\...\\xxx.params 或 /mnt/d/.../xxx.params"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question">现象描述（选填）</Label>
                  <Textarea
                    id="question"
                    name="question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    rows={6}
                    placeholder="例如：Position 模式低空悬停会缓慢画圈，松杆仍漂移，不像高频抖动..."
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="apiBase">LLM API Base</Label>
                  <Input
                    id="apiBase"
                    name="apiBase"
                    value={apiBase}
                    onChange={(event) => setApiBase(event.target.value)}
                    placeholder="例如 http://192.168.2.158:8310/v1 或 https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">LLM API Key（选填，不会显示明文）</Label>
                  <Input
                    id="apiKey"
                    name="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="本地无鉴权服务可留空"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">模型名（选填）</Label>
                  <Input
                    id="model"
                    name="model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="留空使用默认模型"
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  开始诊断
                </Button>
                <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span>前端状态：{clientStatus}</span>
                    <span className="shrink-0 font-mono">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                    />
                  </div>
                  {activeRunId && <div className="font-mono text-[11px]">Run ID: {activeRunId}</div>}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>运行失败</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="report" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="report">诊断报告</TabsTrigger>
                <TabsTrigger value="charts">图表</TabsTrigger>
                <TabsTrigger value="params">参数文件</TabsTrigger>
                <TabsTrigger value="logs">运行输出</TabsTrigger>
              </TabsList>

              <TabsContent value="report" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileChartColumn className="size-5" /> diagnosis.md
                      </CardTitle>
                      <CardDescription>{result?.outputDir ?? "诊断完成后这里显示 Markdown 报告"}</CardDescription>
                    </div>
                    {result && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open(result.reportUrl, "_blank", "noopener,noreferrer")}
                        >
                          <Download className="size-4" /> 打开 Markdown
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open(result.pdfUrl ?? result.reportUrl.replace(/diagnosis\.md$/, "diagnosis.pdf"), "_blank", "noopener,noreferrer")}
                        >
                          <Download className="size-4" /> 下载 PDF
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open(result.snapshotUrl ?? result.reportUrl.replace(/diagnosis\.md$/, "snapshot.json"), "_blank", "noopener,noreferrer")}
                        >
                          <Download className="size-4" /> 打开 Snapshot
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[620px] rounded-xl border bg-muted/20 p-5">
                      {report ? (
                        <article className="prose prose-invert max-w-none prose-headings:tracking-tight prose-pre:bg-black/50 prose-code:text-emerald-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                        </article>
                      ) : (
                        <EmptyState title="还没有报告" description="选择飞行日志文件并点击开始诊断。" />
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="charts" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>诊断图表</CardTitle>
                    <CardDescription>姿态、FFT、电机、振动、电池图表预览。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {result?.charts?.length ? (
                      <div className="grid gap-4 xl:grid-cols-2">
                        {result.charts.map((chart) => (
                          <Card key={chart.name} className="overflow-hidden">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">{chart.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={chart.url} alt={chart.name} className="w-full rounded-lg border bg-white" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="暂无图表" description="诊断完成后自动显示 5 张分析图。" />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="params" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileSliders className="size-5" /> diagnosis_recommendations.params
                      </CardTitle>
                      <CardDescription>可导入 QGroundControl 的参数建议文件。</CardDescription>
                    </div>
                    {result && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(result.paramsUrl, "_blank", "noopener,noreferrer")}
                      >
                        <Download className="size-4" /> 下载参数
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[420px] rounded-xl border bg-black/40 p-4">
                      {paramsPreview ? (
                        <pre className="text-sm text-emerald-100">{paramsPreview}</pre>
                      ) : (
                        <EmptyState title="暂无参数文件" description="诊断完成后这里显示建议参数。" />
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="size-5" /> Python 运行输出
                    </CardTitle>
                    <CardDescription>用于排查环境、依赖和 LLM 连接问题。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] rounded-xl border bg-black/40 p-4">
                      <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {result ? `${result.stdout}\n${result.stderr ?? ""}` : "暂无运行输出。"}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>
    </main>
  );
}

function FilePicker({
  id,
  name,
  label,
  hint,
  accept,
  file,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="rounded-xl border border-dashed bg-muted/20 p-3">
        <Input
          id={id}
          name={name}
          type="file"
          accept={accept}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          className="cursor-pointer"
        />
        <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <Upload className="mt-0.5 size-3.5 shrink-0" />
          <span>{file ? `已选择：${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : hint}</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <div className="rounded-full border bg-background p-3">
        <Radar className="size-6" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm">{description}</p>
    </div>
  );
}
