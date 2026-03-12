import { describe, expect, it } from "vitest";
import {
  executeImageTaskTool,
  executePromptInputSchema,
  executePromptTool,
  executeTaskInputSchema,
  executeTaskTool,
  inspectGeminiCliTool,
} from "../src/mcp/tools.js";
import type { GeminiExecutionResult } from "../src/types.js";

const successResult: GeminiExecutionResult = {
  ok: true,
  finalText: "done",
  stdout: "done\n",
  stderr: "",
  exitCode: 0,
  signal: null,
  elapsedMs: 12,
  timedOut: false,
  aborted: false,
  command: "gemini",
  args: ["-p", "do work"],
};

describe("executePromptInputSchema", () => {
  it("accepts the expected prompt payload", () => {
    const parsed = executePromptInputSchema.parse({
      prompt: "do work",
      model: "gemini-2.5-pro",
      timeoutMs: 5_000,
    });

    expect(parsed.model).toBe("gemini-2.5-pro");
  });

  it("rejects out-of-range timeouts", () => {
    const result = executePromptInputSchema.safeParse({
      prompt: "do work",
      timeoutMs: 999,
    });

    expect(result.success).toBe(false);
  });

  it("accepts delegated task payloads", () => {
    const parsed = executeTaskInputSchema.parse({
      task: "查詢台北市今天的天氣",
      context: "使用繁體中文，回答簡短。",
      expectedOutput: "提供天氣概況、溫度與外出建議。",
      timeoutMs: 5_000,
    });

    expect(parsed.task).toContain("台北市");
  });

  it("accepts an explicit approval mode", () => {
    const parsed = executePromptInputSchema.parse({
      prompt: "write a file",
      approvalMode: "auto_edit",
    });

    expect(parsed.approvalMode).toBe("auto_edit");
  });
});

describe("executePromptTool", () => {
  it("returns structured content and text content from the runner result", async () => {
    const result = await executePromptTool(
      { prompt: "do work" },
      {
        runner: async () => successResult,
      },
    );

    expect(result.isError).toBe(false);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toBe("done");
    expect(result.structuredContent).toEqual(successResult);
  });

  it("wraps delegated tasks into a direct-answer result", async () => {
    let capturedPrompt = "";
    let capturedBaseArgs: string[] = [];

    const result = await executeTaskTool(
      {
        task: "查詢台北市今天的天氣",
        expectedOutput: "提供天氣概況與外出建議。",
      },
      {
        runner: async (input, options) => {
          capturedPrompt = input.prompt;
          capturedBaseArgs = options?.baseArgs ?? [];
          return {
            ...successResult,
            finalText: "台北今天多雲到晴，建議早晚加外套。",
            stdout: "台北今天多雲到晴，建議早晚加外套。\n",
          };
        },
      },
    );

    expect(capturedPrompt).toContain("任務:");
    expect(capturedPrompt).toContain("不要寫像是『我將為您查詢』這類前言");
    expect(capturedBaseArgs).toEqual([]);
    expect(result.content[0]?.text).toBe("台北今天多雲到晴，建議早晚加外套。");
    expect(result.structuredContent.answer).toBe(
      "台北今天多雲到晴，建議早晚加外套。",
    );
  });

  it("automatically uses auto_edit for file-mutating tasks", async () => {
    let capturedBaseArgs: string[] = [];

    await executeTaskTool(
      {
        task: "建立一個 cat.svg 檔案並寫入內容",
      },
      {
        runner: async (_input, options) => {
          capturedBaseArgs = options?.baseArgs ?? [];
          return successResult;
        },
      },
    );

    expect(capturedBaseArgs).toEqual(["--approval-mode", "auto_edit"]);
  });

  it("inspects Gemini CLI capabilities via command-based probes", async () => {
    const result = await inspectGeminiCliTool(
      {
        includeModelReportedTools: true,
      },
      {
        commandRunner: async (input) => {
          const joined = input.args.join(" ");

          if (joined === "--version") {
            return {
              ...successResult,
              finalText: "0.33.0",
              stdout: "0.33.0\n",
              args: input.args,
            };
          }

          if (joined === "--help") {
            return {
              ...successResult,
              finalText: "Usage",
              stdout: [
                "Usage: gemini [options] [command]",
                "",
                "Commands:",
                "  gemini mcp     Manage MCP servers",
                "  gemini skills  Manage agent skills",
                "Positionals:",
              ].join("\n"),
              args: input.args,
            };
          }

          if (joined === "extensions list") {
            return {
              ...successResult,
              finalText: "extensions",
              stdout: [
                "✓ nanobanana (1.0.10)",
                " Path: /tmp/nanobanana",
                " Source: https://example.com/nanobanana (Type: github-release)",
                " Enabled (User): true",
                " Enabled (Workspace): true",
                " MCP servers:",
                "  nanobanana",
              ].join("\n"),
              args: input.args,
            };
          }

          if (joined === "skills list --all") {
            return {
              ...successResult,
              finalText: "skills",
              stdout: [
                "Discovered Agent Skills:",
                "",
                "svg-art [Enabled]",
                "  Description: Create SVG graphics.",
                "  Location: /tmp/svg-art/SKILL.md",
              ].join("\n"),
              args: input.args,
            };
          }

          if (joined === "mcp list") {
            return {
              ...successResult,
              finalText: "mcp",
              stdout: [
                "Configured MCP servers:",
                "",
                "✓ context7: https://mcp.context7.com/mcp (http) - Connected",
              ].join("\n"),
              args: input.args,
            };
          }

          return {
            ...successResult,
            finalText: "probe",
            stdout: JSON.stringify({
              response: [
                "### 內建工具 (Built-in Tools)",
                "- `read_file`",
                "- `write_file`",
                "### 擴充功能 (Extensions)",
                "- **nanobanana**",
                "### 技能 (Skills)",
                "- `svg-art`",
                "### MCP 伺服器 (MCP Servers)",
                "- **context7**",
              ].join("\n"),
            }),
            args: input.args,
          };
        },
      },
    );

    expect(result.structuredContent.version).toBe("0.33.0");
    expect(result.structuredContent.commands[0]?.command).toBe("gemini mcp");
    expect(result.structuredContent.extensions[0]?.name).toBe("nanobanana");
    expect(result.structuredContent.skills[0]?.name).toBe("svg-art");
    expect(result.structuredContent.mcpServers[0]?.name).toBe("context7");
    expect(result.structuredContent.modelReportedTools).toContain(
      "Built-in Tools",
    );
    expect(result.structuredContent.modelReportedSummary?.builtInTools).toEqual(
      ["read_file", "write_file"],
    );
    expect(result.structuredContent.modelReportedSummary?.extensions).toEqual([
      "nanobanana",
    ]);
  });

  it("wraps nanobanana image generation into a stable result", async () => {
    let capturedPrompt = "";
    let capturedBaseArgs: string[] = [];

    const result = await executeImageTaskTool(
      {
        prompt: "a cute orange cat portrait",
        count: 1,
        styles: ["watercolor"],
      },
      {
        runner: async (input, options) => {
          capturedPrompt = input.prompt;
          capturedBaseArgs = options?.baseArgs ?? [];
          return {
            ...successResult,
            finalText: JSON.stringify({ response: "/tmp/cat.png" }),
            stdout: JSON.stringify({ response: "/tmp/cat.png" }),
          };
        },
      },
    );

    expect(capturedPrompt).toContain('/generate "a cute orange cat portrait"');
    expect(capturedPrompt).toContain("--count=1");
    expect(capturedPrompt).toContain('--styles="watercolor"');
    expect(capturedBaseArgs).toEqual([
      "-e",
      "nanobanana",
      "--approval-mode",
      "yolo",
      "--output-format",
      "json",
    ]);
    expect(result.structuredContent.imagePaths).toEqual(["/tmp/cat.png"]);
    expect(result.structuredContent.primaryImagePath).toBe("/tmp/cat.png");
  });

  it("surfaces invalid working directories", async () => {
    await expect(
      executePromptTool(
        {
          prompt: "do work",
          cwd: "/definitely/not/a/real/path",
        },
        {
          runner: async () => successResult,
        },
      ),
    ).rejects.toThrow(/Working directory/);
  });
});
