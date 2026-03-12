import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGeminiPrompt } from "../src/cli/geminiRunner.js";

const here = dirname(fileURLToPath(import.meta.url));
const fakeGeminiPath = resolve(here, "fixtures", "fake-gemini.mjs");

describe("runGeminiPrompt", () => {
  afterEach(() => {
    delete process.env.FAKE_GEMINI_SCENARIO;
  });

  it("captures stdout, stderr and metadata on success", async () => {
    const result = await runGeminiPrompt(
      {
        prompt: "say hello",
        model: "gemini-2.5-pro",
      },
      {
        command: process.execPath,
        baseArgs: [fakeGeminiPath],
        env: {
          FAKE_GEMINI_SCENARIO: "success",
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(result.stdout).toContain("prompt=say hello");
    expect(result.stdout).toContain("model=gemini-2.5-pro");
    expect(result.stderr).toContain("simulated stderr");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.aborted).toBe(false);
  });

  it("surfaces non-zero exits without throwing", async () => {
    const result = await runGeminiPrompt(
      {
        prompt: "break",
      },
      {
        command: process.execPath,
        baseArgs: [fakeGeminiPath],
        env: {
          FAKE_GEMINI_SCENARIO: "fail",
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(17);
    expect(result.stderr).toContain("simulated failure");
  });

  it("marks timed out executions", async () => {
    const result = await runGeminiPrompt(
      {
        prompt: "slow",
        timeoutMs: 50,
      },
      {
        command: process.execPath,
        baseArgs: [fakeGeminiPath],
        env: {
          FAKE_GEMINI_SCENARIO: "sleep",
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it("marks aborted executions", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    const result = await runGeminiPrompt(
      {
        prompt: "abort me",
        timeoutMs: 5_000,
      },
      {
        command: process.execPath,
        baseArgs: [fakeGeminiPath],
        env: {
          FAKE_GEMINI_SCENARIO: "sleep",
        },
        signal: controller.signal,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.aborted).toBe(true);
  });

  it("returns a clear spawn error when the CLI is unavailable", async () => {
    const result = await runGeminiPrompt(
      { prompt: "missing" },
      { command: "/path/does/not/exist" },
    );

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });
});
