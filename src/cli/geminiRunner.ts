import {
  buildGeminiArgs,
  DEFAULT_MODEL_FLAG,
  DEFAULT_PROMPT_FLAG,
} from "./buildArgs.js";
import { runGeminiCommand } from "./geminiCommandRunner.js";
import type {
  ExecutePromptInput,
  GeminiExecutionResult,
  GeminiRunnerOptions,
} from "../types.js";

function getFlagOverrides(env: NodeJS.ProcessEnv | undefined) {
  return {
    promptFlag: env?.GEMINI_PROMPT_FLAG ?? DEFAULT_PROMPT_FLAG,
    modelFlag: env?.GEMINI_MODEL_FLAG ?? DEFAULT_MODEL_FLAG,
  };
}

export async function runGeminiPrompt(
  input: ExecutePromptInput,
  options: GeminiRunnerOptions = {},
): Promise<GeminiExecutionResult> {
  const args = [
    ...(options.baseArgs ?? []),
    ...buildGeminiArgs(input, getFlagOverrides(options.env)),
  ];

  return await runGeminiCommand(
    {
      args,
      ...(input.cwd ? { cwd: input.cwd } : {}),
      ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    },
    options,
  );
}
