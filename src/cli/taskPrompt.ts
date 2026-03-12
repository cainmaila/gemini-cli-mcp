interface TaskPromptInput {
  task: string;
  context?: string | undefined;
  expectedOutput?: string | undefined;
}

function formatOptionalSection(title: string, value?: string): string {
  if (!value?.trim()) {
    return "";
  }

  return `${title}:\n${value.trim()}\n\n`;
}

export function buildTaskPrompt(input: TaskPromptInput): string {
  const expectedOutput = input.expectedOutput?.trim()
    ? input.expectedOutput.trim()
    : "直接提供可交付的最終答案。避免描述你將要做什麼，避免多餘前言，除非任務要求，否則不要解釋推理過程。";

  return [
    "你是另一個 AI 系統委派的任務執行代理。",
    "你的工作是完成任務並只回傳對上游 AI 有用的最終結果。",
    "規則:",
    "1. 直接回答，不要寫像是『我將為您查詢』這類前言。",
    "2. 若資訊具有時效性或不確定性，簡短說明限制或假設。",
    "3. 預設使用繁體中文，除非任務明確要求其他語言。",
    "4. 除非任務要求，不要描述你的工具使用過程。",
    "",
    "任務:",
    input.task.trim(),
    "",
    formatOptionalSection("補充上下文", input.context),
    "期望輸出:",
    expectedOutput,
  ]
    .filter((part) => part !== "")
    .join("\n")
    .trim();
}
