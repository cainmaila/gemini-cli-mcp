import type { ExecutePromptInput } from "../types.js";

export const DEFAULT_TIMEOUT_MS = 60_000;
export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 10 * 60_000;
export const DEFAULT_PROMPT_FLAG = "-p";
export const DEFAULT_MODEL_FLAG = "--model";

export interface GeminiFlagOptions {
  promptFlag?: string;
  modelFlag?: string;
}

export function normalizeTimeout(timeoutMs?: number): number {
  return timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

export function buildGeminiArgs(
  input: Pick<ExecutePromptInput, "prompt" | "model">,
  options: GeminiFlagOptions = {},
): string[] {
  const promptFlag = options.promptFlag ?? DEFAULT_PROMPT_FLAG;
  const modelFlag = options.modelFlag ?? DEFAULT_MODEL_FLAG;
  const args: string[] = [];

  if (input.model) {
    args.push(modelFlag, input.model);
  }

  args.push(promptFlag, input.prompt);

  return args;
}
