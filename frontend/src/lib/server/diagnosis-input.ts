import type { NextRequest } from "next/server";

export type DiagnoseInput = {
  logfile?: string;
  paramsFile?: string;
  question?: string;
  hardwareFile?: string;
  apiBase?: string;
  apiKey?: string;
  model?: string;
  uploadedLog?: File;
  uploadedParams?: File;
  metadata?: Record<string, string>;
};

const METADATA_FIELDS = ["testTime", "testLocation", "testProject", "testOperator", "testAircraft"] as const;

function readMetadataFromForm(form: FormData) {
  const metadata: Record<string, string> = {};
  for (const key of METADATA_FIELDS) {
    const value = String(form.get(key) || "").trim();
    if (value) metadata[key] = value;
  }
  return metadata;
}

export async function parseDiagnoseInput(request: NextRequest): Promise<DiagnoseInput> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const uploadedLog = form.get("logfileUpload");
    const uploadedParams = form.get("paramsUpload");
    return {
      logfile: String(form.get("logfile") || ""),
      paramsFile: String(form.get("paramsFile") || ""),
      question: String(form.get("question") || ""),
      hardwareFile: String(form.get("hardwareFile") || ""),
      apiBase: String(form.get("apiBase") || ""),
      apiKey: String(form.get("apiKey") || ""),
      model: String(form.get("model") || ""),
      uploadedLog: uploadedLog instanceof File && uploadedLog.size > 0 ? uploadedLog : undefined,
      uploadedParams: uploadedParams instanceof File && uploadedParams.size > 0 ? uploadedParams : undefined,
      metadata: readMetadataFromForm(form),
    };
  }
  return (await request.json()) as DiagnoseInput;
}
