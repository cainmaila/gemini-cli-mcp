export const SERVER_NAME = "gemini-cli-mcp";
export const SERVER_VERSION = "0.1.0";

export type GeminiApprovalMode = "default" | "auto_edit" | "yolo" | "plan";

export interface ExecutePromptInput {
  prompt: string;
  model?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface ExecuteTaskInput {
  task: string;
  context?: string;
  expectedOutput?: string;
  model?: string;
  cwd?: string;
  timeoutMs?: number;
  approvalMode?: GeminiApprovalMode;
}

export interface GeminiCommandInput {
  args: string[];
  cwd?: string;
  timeoutMs?: number;
}

export interface GeminiExecutionResult {
  [key: string]: unknown;
  ok: boolean;
  finalText: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  elapsedMs: number;
  timedOut: boolean;
  aborted: boolean;
  command: string;
  args: string[];
  workingDirectory?: string;
  errorMessage?: string;
}

export interface GeminiRunnerOptions {
  command?: string;
  baseArgs?: string[];
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

export interface GeminiCliCommandInfo {
  command: string;
  description: string;
}

export interface GeminiCliExtensionInfo {
  name: string;
  version: string;
  path?: string;
  source?: string;
  enabledUser?: boolean;
  enabledWorkspace?: boolean;
  mcpServers?: string[];
}

export interface GeminiCliSkillInfo {
  name: string;
  enabled: boolean;
  builtIn: boolean;
  description?: string;
  location?: string;
}

export interface GeminiCliMcpServerInfo {
  name: string;
  target: string;
  transport: string;
  status: string;
}

export interface GeminiCliModelReportedSummary {
  builtInTools: string[];
  extensions: string[];
  skills: string[];
  mcpServers: string[];
}

export interface GeminiCliInspectionResult {
  [key: string]: unknown;
  version: string;
  commands: GeminiCliCommandInfo[];
  extensions: GeminiCliExtensionInfo[];
  skills: GeminiCliSkillInfo[];
  mcpServers: GeminiCliMcpServerInfo[];
  modelReportedTools?: string;
  modelReportedSummary?: GeminiCliModelReportedSummary;
  notes: string[];
  raw: {
    help: string;
    extensions: string;
    skills: string;
    mcpServers: string;
    modelReportedTools?: string;
  };
}
