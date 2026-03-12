import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_FLAG,
  DEFAULT_PROMPT_FLAG,
  buildGeminiArgs,
  normalizeTimeout,
} from "../src/cli/buildArgs.js";

describe("buildGeminiArgs", () => {
  it("builds args with the default prompt flag", () => {
    expect(buildGeminiArgs({ prompt: "hello" })).toEqual([
      DEFAULT_PROMPT_FLAG,
      "hello",
    ]);
  });

  it("includes the model flag when a model is provided", () => {
    expect(
      buildGeminiArgs({ prompt: "hello", model: "gemini-2.5-pro" }),
    ).toEqual([
      DEFAULT_MODEL_FLAG,
      "gemini-2.5-pro",
      DEFAULT_PROMPT_FLAG,
      "hello",
    ]);
  });

  it("supports prompt and model flag overrides", () => {
    expect(
      buildGeminiArgs(
        { prompt: "hello", model: "gemini-2.5-flash" },
        { promptFlag: "--prompt", modelFlag: "-m" },
      ),
    ).toEqual(["-m", "gemini-2.5-flash", "--prompt", "hello"]);
  });

  it("uses the default timeout when one is not provided", () => {
    expect(normalizeTimeout()).toBe(60_000);
    expect(normalizeTimeout(42_000)).toBe(42_000);
  });
});
