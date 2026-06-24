export type WizardStep = "upload" | "describe" | "running";

export type WizardFormState = {
  logfile: string;
  paramsFile: string;
  question: string;
  apiBase: string;
  apiKey: string;
  model: string;
  testTime: string;
  testLocation: string;
  testProject: string;
  testOperator: string;
  testAircraft: string;
  logUpload: File | null;
  paramsUpload: File | null;
};
