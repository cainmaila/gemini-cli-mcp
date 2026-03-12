import { spawn } from "node:child_process";
import { normalizeTimeout } from "./buildArgs.js";
import type {
  GeminiCommandInput,
  GeminiExecutionResult,
  GeminiRunnerOptions,
} from "../types.js";

const DEFAULT_COMMAND = "gemini";
const KILL_GRACE_MS = 5_000;

export async function runGeminiCommand(
  input: GeminiCommandInput,
  options: GeminiRunnerOptions = {},
): Promise<GeminiExecutionResult> {
  const startedAt = Date.now();
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  const command =
    options.command ?? options.env?.GEMINI_CLI_PATH ?? DEFAULT_COMMAND;
  const env = {
    ...process.env,
    ...options.env,
  };

  return await new Promise<GeminiExecutionResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let resolved = false;
    let timedOut = false;
    let aborted = options.signal?.aborted ?? false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let spawnError: Error | undefined;
    let killTimer: NodeJS.Timeout | undefined;

    const finish = () => {
      if (resolved) {
        return;
      }

      resolved = true;
      if (killTimer) {
        clearTimeout(killTimer);
      }

      const elapsedMs = Date.now() - startedAt;
      const finalText = stdout.trim();
      const ok = !spawnError && !timedOut && !aborted && exitCode === 0;

      resolve({
        ok,
        finalText,
        stdout,
        stderr,
        exitCode,
        signal: exitSignal,
        elapsedMs,
        timedOut,
        aborted,
        command,
        args: input.args,
        ...(input.cwd ? { workingDirectory: input.cwd } : {}),
        ...(spawnError?.message ? { errorMessage: spawnError.message } : {}),
      });
    };

    const child = spawn(command, input.args, {
      cwd: input.cwd,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stopChild = (reason: "timeout" | "abort") => {
      if (reason === "timeout") {
        timedOut = true;
      } else {
        aborted = true;
      }

      if (child.killed) {
        return;
      }

      child.kill("SIGTERM");
      killTimer = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, KILL_GRACE_MS);
    };

    const timeoutHandle = setTimeout(() => {
      stopChild("timeout");
    }, timeoutMs);

    const abortHandler = () => {
      stopChild("abort");
    };

    options.signal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      spawnError = error;
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeoutHandle);
      options.signal?.removeEventListener("abort", abortHandler);
      exitCode = code;
      exitSignal = signal;
      finish();
    });

    child.on("spawn", () => {
      if (options.signal?.aborted) {
        stopChild("abort");
      }
    });

    if (options.signal?.aborted) {
      stopChild("abort");
    }
  });
}
