import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from "../cli/buildArgs.js";
import { inspectGeminiCli } from "../cli/geminiInspector.js";
import { runGeminiPrompt } from "../cli/geminiRunner.js";
import { buildTaskPrompt } from "../cli/taskPrompt.js";
import type {
  ExecutePromptInput,
  ExecuteTaskInput,
  GeminiApprovalMode,
  GeminiCliInspectionResult,
  GeminiCommandInput,
  GeminiExecutionResult,
  GeminiRunnerOptions,
} from "../types.js";

const approvalModeSchema = z.enum(["default", "auto_edit", "yolo", "plan"]);

const FILE_MUTATION_PATTERN =
  /\b(write|save|create|edit|modify|delete|rename|move|overwrite|generate)\b|建立|新增|寫入|存成|存為|修改|編輯|刪除|重新命名|移動|覆寫|輸出.*檔案|產生.*檔案/i;

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
  approvalMode: approvalModeSchema
    .optional()
    .describe("Optional Gemini CLI approval mode"),
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
  effectiveApprovalMode: approvalModeSchema.optional(),
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
  approvalMode: approvalModeSchema
    .optional()
    .describe(
      "Optional Gemini CLI approval mode. If omitted, file-mutating tasks default to auto_edit.",
    ),
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
  effectiveApprovalMode: approvalModeSchema.optional(),
  workingDirectory: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const inspectGeminiCliInputSchema = z.object({
  includeModelReportedTools: z
    .boolean()
    .optional()
    .describe(
      "Whether to ask Gemini itself for a model-reported summary of currently active tools.",
    ),
  timeoutMs: z
    .number()
    .int()
    .min(MIN_TIMEOUT_MS)
    .max(MAX_TIMEOUT_MS)
    .optional()
    .describe("Optional timeout in milliseconds for each inspection command"),
});

export const inspectGeminiCliOutputSchema = z.object({
  version: z.string(),
  commands: z.array(
    z.object({
      command: z.string(),
      description: z.string(),
    }),
  ),
  extensions: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      path: z.string().optional(),
      source: z.string().optional(),
      enabledUser: z.boolean().optional(),
      enabledWorkspace: z.boolean().optional(),
      mcpServers: z.array(z.string()).optional(),
    }),
  ),
  skills: z.array(
    z.object({
      name: z.string(),
      enabled: z.boolean(),
      builtIn: z.boolean(),
      description: z.string().optional(),
      location: z.string().optional(),
    }),
  ),
  mcpServers: z.array(
    z.object({
      name: z.string(),
      target: z.string(),
      transport: z.string(),
      status: z.string(),
    }),
  ),
  modelReportedTools: z.string().optional(),
  modelReportedSummary: z
    .object({
      builtInTools: z.array(z.string()),
      extensions: z.array(z.string()),
      skills: z.array(z.string()),
      mcpServers: z.array(z.string()),
    })
    .optional(),
  notes: z.array(z.string()),
  raw: z.object({
    help: z.string(),
    extensions: z.string(),
    skills: z.string(),
    mcpServers: z.string(),
    modelReportedTools: z.string().optional(),
  }),
});

export const executeImageTaskInputSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1)
    .describe("Image generation prompt for the nanobanana extension"),
  count: z
    .number()
    .int()
    .min(1)
    .max(8)
    .optional()
    .describe("Optional number of images to generate"),
  styles: z
    .array(z.string().trim().min(1))
    .optional()
    .describe("Optional style names passed to nanobanana"),
  variations: z
    .array(z.string().trim().min(1))
    .optional()
    .describe("Optional variation names passed to nanobanana"),
  cwd: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Optional working directory for generated image output"),
  timeoutMs: z
    .number()
    .int()
    .min(MIN_TIMEOUT_MS)
    .max(MAX_TIMEOUT_MS)
    .optional()
    .describe("Optional timeout in milliseconds"),
  approvalMode: approvalModeSchema
    .optional()
    .describe(
      "Optional Gemini CLI approval mode. Defaults to yolo for nanobanana.",
    ),
});

export const executeImageTaskOutputSchema = z.object({
  ok: z.boolean(),
  responseText: z.string(),
  imagePaths: z.array(z.string()),
  primaryImagePath: z.string().optional(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  elapsedMs: z.number().int().nonnegative(),
  timedOut: z.boolean(),
  aborted: z.boolean(),
  command: z.string(),
  args: z.array(z.string()),
  effectiveApprovalMode: approvalModeSchema.optional(),
  workingDirectory: z.string().optional(),
  errorMessage: z.string().optional(),
});

export interface ExecutePromptDependencies {
  runner?: (
    input: ExecutePromptInput,
    options?: GeminiRunnerOptions,
  ) => Promise<GeminiExecutionResult>;
  commandRunner?: (
    input: GeminiCommandInput,
    options?: GeminiRunnerOptions,
  ) => Promise<GeminiExecutionResult>;
}

export type ExecutePromptToolInput = z.input<typeof executePromptInputSchema>;
export type ExecuteTaskToolInput = z.input<typeof executeTaskInputSchema>;
export type ExecuteImageTaskToolInput = z.input<
  typeof executeImageTaskInputSchema
>;
export type InspectGeminiCliToolInput = z.input<
  typeof inspectGeminiCliInputSchema
>;

function quoteShellValue(value: string): string {
  return JSON.stringify(value);
}

function buildNanobananaPrompt(input: {
  prompt: string;
  count?: number | undefined;
  styles?: string[] | undefined;
  variations?: string[] | undefined;
}): string {
  const parts = ["/generate", quoteShellValue(input.prompt.trim())];

  if (input.count !== undefined) {
    parts.push(`--count=${input.count}`);
  }
  if (input.styles && input.styles.length > 0) {
    parts.push(`--styles=${quoteShellValue(input.styles.join(","))}`);
  }
  if (input.variations && input.variations.length > 0) {
    parts.push(`--variations=${quoteShellValue(input.variations.join(","))}`);
  }

  return [
    parts.join(" "),
    "Save generated image file path(s) and reply with the saved file path(s) only, one path per line.",
  ].join(" ");
}

function extractImagePaths(text: string): string[] {
  const matches =
    text.match(
      /(?:\/[^\s"']+|(?:\.\.?\/)?[A-Za-z0-9_.-][^\s"']*)\.(?:png|jpe?g|webp|svg)\b/g,
    ) ?? [];

  return [...new Set(matches.map((value) => value.trim()))];
}

function buildApprovalArgs(approvalMode?: GeminiApprovalMode): string[] {
  return approvalMode ? ["--approval-mode", approvalMode] : [];
}

function inferTaskApprovalMode(input: {
  task: string;
  context?: string | undefined;
  expectedOutput?: string | undefined;
  approvalMode?: GeminiApprovalMode | undefined;
}): GeminiApprovalMode | undefined {
  if (input.approvalMode) {
    return input.approvalMode;
  }

  const combinedText = [input.task, input.context, input.expectedOutput]
    .filter(Boolean)
    .join("\n");

  if (FILE_MUTATION_PATTERN.test(combinedText)) {
    return "auto_edit";
  }

  return undefined;
}

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
  const approvalMode = validatedInput.approvalMode;
  const cwd = await resolveWorkingDirectory(validatedInput.cwd);
  const runnerInput: ExecutePromptInput = {
    prompt: validatedInput.prompt,
    ...(validatedInput.model ? { model: validatedInput.model } : {}),
    ...(cwd ? { cwd } : {}),
    ...(validatedInput.timeoutMs !== undefined
      ? { timeoutMs: validatedInput.timeoutMs }
      : {}),
  };

  const mergedBaseArgs = [
    ...buildApprovalArgs(approvalMode),
    ...(options.baseArgs ?? []),
  ];
  const mergedOptions: GeminiRunnerOptions = {
    ...options,
    ...(mergedBaseArgs.length > 0 ? { baseArgs: mergedBaseArgs } : {}),
  };
  const finalResult = await runner(runnerInput, mergedOptions);

  return {
    isError: !finalResult.ok,
    content: [{ type: "text" as const, text: renderToolText(finalResult) }],
    structuredContent: {
      ...finalResult,
      ...(approvalMode ? { effectiveApprovalMode: approvalMode } : {}),
    },
  };
}

export async function executeTaskTool(
  input: ExecuteTaskToolInput,
  dependencies: ExecutePromptDependencies = {},
  options: GeminiRunnerOptions = {},
) {
  const validatedInput = executeTaskInputSchema.parse(input);
  const approvalMode = inferTaskApprovalMode(validatedInput);
  const prompt = buildTaskPrompt(validatedInput);
  const result = await executePromptTool(
    {
      prompt,
      ...(validatedInput.model ? { model: validatedInput.model } : {}),
      ...(validatedInput.cwd ? { cwd: validatedInput.cwd } : {}),
      ...(validatedInput.timeoutMs !== undefined
        ? { timeoutMs: validatedInput.timeoutMs }
        : {}),
      ...(approvalMode ? { approvalMode } : {}),
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
      ...(structuredContent.effectiveApprovalMode
        ? { effectiveApprovalMode: structuredContent.effectiveApprovalMode }
        : {}),
      ...(structuredContent.workingDirectory
        ? { workingDirectory: structuredContent.workingDirectory }
        : {}),
      ...(structuredContent.errorMessage
        ? { errorMessage: structuredContent.errorMessage }
        : {}),
    },
  };
}

export async function inspectGeminiCliTool(
  input: InspectGeminiCliToolInput,
  dependencies: ExecutePromptDependencies = {},
  options: GeminiRunnerOptions = {},
) {
  const validatedInput = inspectGeminiCliInputSchema.parse(input);
  const commandRunner = dependencies.commandRunner;
  const inspection = await inspectGeminiCli(
    validatedInput,
    commandRunner,
    options,
  );

  const summaryLines = [
    `Gemini CLI ${inspection.version}`,
    `commands: ${inspection.commands.length}`,
    `extensions: ${inspection.extensions.length}`,
    `skills: ${inspection.skills.length}`,
    `mcpServers: ${inspection.mcpServers.length}`,
  ];

  if (inspection.modelReportedTools) {
    summaryLines.push("modelReportedTools: available");
  }

  if (inspection.notes.length > 0) {
    summaryLines.push(`notes: ${inspection.notes.join(" | ")}`);
  }

  return {
    isError: false,
    content: [{ type: "text" as const, text: summaryLines.join("\n") }],
    structuredContent: inspection satisfies GeminiCliInspectionResult,
  };
}

export async function executeImageTaskTool(
  input: ExecuteImageTaskToolInput,
  dependencies: ExecutePromptDependencies = {},
  options: GeminiRunnerOptions = {},
) {
  const runner = dependencies.runner ?? runGeminiPrompt;
  const validatedInput = executeImageTaskInputSchema.parse(input);
  const cwd = await resolveWorkingDirectory(validatedInput.cwd);
  const approvalMode = validatedInput.approvalMode ?? "yolo";
  const prompt = buildNanobananaPrompt(validatedInput);

  const result = await runner(
    {
      prompt,
      ...(cwd ? { cwd } : {}),
      ...(validatedInput.timeoutMs !== undefined
        ? { timeoutMs: validatedInput.timeoutMs }
        : {}),
    },
    {
      ...options,
      baseArgs: [
        "-e",
        "nanobanana",
        ...buildApprovalArgs(approvalMode),
        "--output-format",
        "json",
        ...(options.baseArgs ?? []),
      ],
    },
  );

  let responseText = result.finalText;
  try {
    const payload = JSON.parse(result.stdout) as { response?: string };
    if (payload.response?.trim()) {
      responseText = payload.response.trim();
    }
  } catch {
    // Keep raw final text when Gemini did not emit JSON payload.
  }

  const imagePaths = extractImagePaths(responseText);

  return {
    isError: !result.ok,
    content: [{ type: "text" as const, text: responseText }],
    structuredContent: {
      ok: result.ok,
      responseText,
      imagePaths,
      ...(imagePaths[0] ? { primaryImagePath: imagePaths[0] } : {}),
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      signal: result.signal,
      elapsedMs: result.elapsedMs,
      timedOut: result.timedOut,
      aborted: result.aborted,
      command: result.command,
      args: result.args,
      effectiveApprovalMode: approvalMode,
      ...(result.workingDirectory
        ? { workingDirectory: result.workingDirectory }
        : {}),
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    },
  };
}

export function registerGeminiTools(
  server: McpServer,
  dependencies: ExecutePromptDependencies = {},
) {
  server.registerTool(
    "executeImageTask",
    {
      title: "Execute Image Task",
      description:
        "Uses the nanobanana extension to generate images and returns saved image paths plus execution metadata.",
      inputSchema: executeImageTaskInputSchema,
      outputSchema: executeImageTaskOutputSchema,
    },
    async (input, context) => {
      return await executeImageTaskTool(input, dependencies, {
        signal: context.signal,
      });
    },
  );

  server.registerTool(
    "inspectGeminiCli",
    {
      title: "Inspect Gemini CLI",
      description:
        "Lists the currently available Gemini CLI commands, extensions, skills, configured MCP servers, and an optional model-reported tool summary.",
      inputSchema: inspectGeminiCliInputSchema,
      outputSchema: inspectGeminiCliOutputSchema,
    },
    async (input, context) => {
      return await inspectGeminiCliTool(input, dependencies, {
        signal: context.signal,
      });
    },
  );

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
