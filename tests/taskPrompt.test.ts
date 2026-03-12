import { describe, expect, it } from "vitest";
import { buildTaskPrompt } from "../src/cli/taskPrompt.js";

describe("buildTaskPrompt", () => {
  it("builds a direct-answer wrapper prompt for delegated tasks", () => {
    const prompt = buildTaskPrompt({
      task: "查詢台北市今天的天氣",
      context: "回答請簡短。",
      expectedOutput: "提供天氣概況與外出建議。",
    });

    expect(prompt).toContain("你是另一個 AI 系統委派的任務執行代理");
    expect(prompt).toContain("任務:");
    expect(prompt).toContain("查詢台北市今天的天氣");
    expect(prompt).toContain("補充上下文");
    expect(prompt).toContain("期望輸出");
    expect(prompt).toContain("不要寫像是『我將為您查詢』這類前言");
  });
});
