"use client";

import { useState } from "react";

import { initialTestTime } from "./wizard-utils.mjs";
import type { WizardFormState, WizardStep } from "./types";

export function useWizardState() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [logfile, setLogfile] = useState("");
  const [paramsFile, setParamsFile] = useState("");
  const [question, setQuestion] = useState("");
  const [apiBase, setApiBase] = useState("http://192.168.2.158:8310/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [testTime, setTestTime] = useState(initialTestTime);
  const [testLocation, setTestLocation] = useState("");
  const [testProject, setTestProject] = useState("");
  const [testOperator, setTestOperator] = useState("");
  const [testAircraft, setTestAircraft] = useState("X760");
  const [logUpload, setLogUpload] = useState<File | null>(null);
  const [paramsUpload, setParamsUpload] = useState<File | null>(null);

  const canProceed = Boolean(logUpload || logfile.trim());

  function next() {
    setStep((prev) => {
      if (prev === "upload") return "describe";
      if (prev === "describe") return "running";
      return prev;
    });
  }

  function prev() {
    setStep((prev) => {
      if (prev === "describe") return "upload";
      return prev;
    });
  }

  function reset() {
    setStep("upload");
    setLogfile("");
    setParamsFile("");
    setQuestion("");
    setLogUpload(null);
    setParamsUpload(null);
  }

  const form: WizardFormState = {
    logfile,
    paramsFile,
    question,
    apiBase,
    apiKey,
    model,
    testTime,
    testLocation,
    testProject,
    testOperator,
    testAircraft,
    logUpload,
    paramsUpload,
  };

  return {
    step,
    setStep,
    next,
    prev,
    reset,
    canProceed,
    form,
    setLogfile,
    setParamsFile,
    setQuestion,
    setApiBase,
    setApiKey,
    setModel,
    setTestTime,
    setTestLocation,
    setTestProject,
    setTestOperator,
    setTestAircraft,
    setLogUpload,
    setParamsUpload,
  };
}

export type WizardState = ReturnType<typeof useWizardState>;
