import { describe, expect, it } from "vitest";
import {
  executePromptInputSchema,
  executePromptTool,
  executeTaskInputSchema,
  executeTaskTool,
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

    const result = await executeTaskTool(
      {
        task: "查詢台北市今天的天氣",
        expectedOutput: "提供天氣概況與外出建議。",
      },
      {
        runner: async (input) => {
          capturedPrompt = input.prompt;
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
    expect(result.content[0]?.text).toBe("台北今天多雲到晴，建議早晚加外套。");
    expect(result.structuredContent.answer).toBe(
      "台北今天多雲到晴，建議早晚加外套。",
    );
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
