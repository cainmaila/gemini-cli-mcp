import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from "../cli/buildArgs.js";
import { runGeminiPrompt } from "../cli/geminiRunner.js";
import { buildTaskPrompt } from "../cli/taskPrompt.js";
import type {
  ExecutePromptInput,
  ExecuteTaskInput,
  GeminiExecutionResult,
  GeminiRunnerOptions,
} from "../types.js";

export const executePromptInputSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1)
    .describe("Prompt to send to the local Gemini CLI"),
  model: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Optional Gemini model name"),
  cwd: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Optional working directory for the Gemini CLI process"),
  timeoutMs: z
    .number()
    .int()
    .min(MIN_TIMEOUT_MS)
    .max(MAX_TIMEOUT_MS)
    .optional()
    .describe("Optional timeout in milliseconds"),
});

export const executePromptOutputSchema = z.object({
  ok: z.boolean(),
  finalText: z.string(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  elapsedMs: z.number().int().nonnegative(),
  timedOut: z.boolean(),
  aborted: z.boolean(),
  command: z.string(),
  args: z.array(z.string()),
  workingDirectory: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const executeTaskInputSchema = z.object({
  task: z
    .string()
    .trim()
    .min(1)
    .describe("Task to delegate to the local Gemini CLI"),
  context: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Optional task context for Gemini"),
  expectedOutput: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Optional instructions describing the desired final answer format",
    ),
  model: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Optional Gemini model name"),
  cwd: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Optional working directory for the Gemini CLI process"),
  timeoutMs: z
    .number()
    .int()
    .min(MIN_TIMEOUT_MS)
    .max(MAX_TIMEOUT_MS)
    .optional()
    .describe("Optional timeout in milliseconds"),
});

export const executeTaskOutputSchema = z.object({
  answer: z.string(),
  ok: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  elapsedMs: z.number().int().nonnegative(),
  timedOut: z.boolean(),
  aborted: z.boolean(),
  command: z.string(),
  args: z.array(z.string()),
  workingDirectory: z.string().optional(),
  errorMessage: z.string().optional(),
});

export interface ExecutePromptDependencies {
  runner?: (
    input: ExecutePromptInput,
    options?: GeminiRunnerOptions,
  ) => Promise<GeminiExecutionResult>;
}

export type ExecutePromptToolInput = z.input<typeof executePromptInputSchema>;
export type ExecuteTaskToolInput = z.input<typeof executeTaskInputSchema>;

async function resolveWorkingDirectory(
  cwd?: string,
): Promise<string | undefined> {
  if (!cwd) {
    return undefined;
  }

  const absolutePath = resolve(cwd);
  const stats = await stat(absolutePath).catch(() => undefined);

  if (!stats || !stats.isDirectory()) {
    throw new Error(
      `Working directory does not exist or is not a directory: ${absolutePath}`,
    );
  }

  await access(absolutePath);
  return absolutePath;
}

function renderToolText(result: GeminiExecutionResult): string {
  if (result.ok) {
    return (
      result.finalText ||
      "Gemini CLI completed successfully but returned no stdout output."
    );
  }

  const details = [
    `Gemini CLI execution failed.`,
    `command: ${result.command}`,
    `exitCode: ${result.exitCode ?? "null"}`,
    `signal: ${result.signal ?? "null"}`,
    `timedOut: ${String(result.timedOut)}`,
    `aborted: ${String(result.aborted)}`,
  ];

  if (result.errorMessage) {
    details.push(`error: ${result.errorMessage}`);
  }

  if (result.stderr.trim()) {
    details.push(`stderr:\n${result.stderr.trim()}`);
  }

  if (result.stdout.trim()) {
    details.push(`stdout:\n${result.stdout.trim()}`);
  }

  return details.join("\n");
}

export async function executePromptTool(
  input: ExecutePromptToolInput,
  dependencies: ExecutePromptDependencies = {},
  options: GeminiRunnerOptions = {},
) {
  const runner = dependencies.runner ?? runGeminiPrompt;
  const validatedInput = executePromptInputSchema.parse(input);
  const cwd = await resolveWorkingDirectory(validatedInput.cwd);
  const runnerInput: ExecutePromptInput = {
    prompt: validatedInput.prompt,
    ...(validatedInput.model ? { model: validatedInput.model } : {}),
    ...(cwd ? { cwd } : {}),
    ...(validatedInput.timeoutMs !== undefined
      ? { timeoutMs: validatedInput.timeoutMs }
      : {}),
  };
  const result = await runner(runnerInput, options);

  return {
    isError: !result.ok,
    content: [{ type: "text" as const, text: renderToolText(result) }],
    structuredContent: result,
  };
}

export async function executeTaskTool(
  input: ExecuteTaskToolInput,
  dependencies: ExecutePromptDependencies = {},
  options: GeminiRunnerOptions = {},
) {
  const validatedInput = executeTaskInputSchema.parse(input);
  const prompt = buildTaskPrompt(validatedInput);
  const result = await executePromptTool(
    {
      prompt,
      ...(validatedInput.model ? { model: validatedInput.model } : {}),
      ...(validatedInput.cwd ? { cwd: validatedInput.cwd } : {}),
      ...(validatedInput.timeoutMs !== undefined
        ? { timeoutMs: validatedInput.timeoutMs }
        : {}),
    },
    dependencies,
    options,
  );

  const structuredContent = result.structuredContent;
  const answer = structuredContent.finalText;

  return {
    isError: result.isError,
    content: [
      { type: "text" as const, text: result.content[0]?.text ?? answer },
    ],
    structuredContent: {
      answer,
      ok: structuredContent.ok,
      stdout: structuredContent.stdout,
      stderr: structuredContent.stderr,
      exitCode: structuredContent.exitCode,
      signal: structuredContent.signal,
      elapsedMs: structuredContent.elapsedMs,
      timedOut: structuredContent.timedOut,
      aborted: structuredContent.aborted,
      command: structuredContent.command,
      args: structuredContent.args,
      ...(structuredContent.workingDirectory
        ? { workingDirectory: structuredContent.workingDirectory }
        : {}),
      ...(structuredContent.errorMessage
        ? { errorMessage: structuredContent.errorMessage }
        : {}),
    },
  };
}

export function registerGeminiTools(
  server: McpServer,
  dependencies: ExecutePromptDependencies = {},
) {
  server.registerTool(
    "executeTask",
    {
      title: "Execute Delegated Task",
      description:
        "AI-friendly task interface. Accepts a task description and returns a direct, meaningful final answer plus execution metadata.",
      inputSchema: executeTaskInputSchema,
      outputSchema: executeTaskOutputSchema,
    },
    async (input, context) => {
      return await executeTaskTool(input, dependencies, {
        signal: context.signal,
      });
    },
  );

  server.registerTool(
    "executePrompt",
    {
      title: "Execute Gemini Prompt",
      description:
        "Runs a non-interactive prompt through the locally installed Gemini CLI and returns the final result plus execution metadata.",
      inputSchema: executePromptInputSchema,
      outputSchema: executePromptOutputSchema,
    },
    async (input, context) => {
      return await executePromptTool(input, dependencies, {
        signal: context.signal,
      });
    },
  );
}
