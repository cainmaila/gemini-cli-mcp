export const SERVER_NAME = "gemini-cli-mcp";
export const SERVER_VERSION = "0.1.0";

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
