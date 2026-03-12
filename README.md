# gemini-cli-mcp

This project provides an MCP server that delegates work to a locally installed Gemini CLI and returns a meaningful final answer plus execution metadata to the MCP caller.

## What It Does

- Exposes two MCP tools: `executeTask` for AI-friendly task delegation and `executePrompt` for low-level prompt control
- Runs Gemini CLI in a non-interactive mode using direct argument passing
- Captures `stdout`, `stderr`, `exitCode`, `signal`, `elapsedMs`, timeout state, and abort state
- Returns failures as structured tool results instead of collapsing them into generic errors
- Makes `executeTask` return a direct final answer, so upstream AI systems can use the result without additional prompt wrapping

## Requirements

- Node.js 18.18 or newer
- A locally installed Gemini CLI that can run unattended
- Local Gemini authentication already completed outside this project

## Installation

```bash
npm install
npm run build
```

## Running The MCP Server

```bash
npm run build
node build/index.js
```

The server communicates over stdio, so it is intended to be launched by an MCP client.

## Tool Contract

### `executeTask`

Use this as the default interface when another AI system wants to delegate a task and receive a directly usable answer.

Input:

```json
{
  "task": "請查詢台北市今天的天氣，並用繁體中文簡短回答：天氣概況、溫度、降雨機率、以及一個外出建議。",
  "expectedOutput": "直接回答，不要寫前言。",
  "timeoutMs": 180000
}
```

Structured output:

```json
{
  "answer": "台北今天多雲到晴，約 11°C 至 19°C，降雨機率低，建議早晚加外套。",
  "ok": true,
  "stdout": "...",
  "stderr": "...",
  "exitCode": 0,
  "signal": null,
  "elapsedMs": 23053,
  "timedOut": false,
  "aborted": false,
  "command": "gemini",
  "args": ["-p", "...wrapped task prompt..."]
}
```

### `executePrompt`

Use this low-level interface when the caller wants to control the exact Gemini prompt directly.

Input:

```json
{
  "prompt": "Summarize the current repository",
  "model": "gemini-2.5-pro",
  "cwd": "/path/to/project",
  "timeoutMs": 60000
}
```

Structured output:

```json
{
  "ok": true,
  "finalText": "...",
  "stdout": "...",
  "stderr": "",
  "exitCode": 0,
  "signal": null,
  "elapsedMs": 1532,
  "timedOut": false,
  "aborted": false,
  "command": "gemini",
  "args": [
    "--model",
    "gemini-2.5-pro",
    "-p",
    "Summarize the current repository"
  ],
  "workingDirectory": "/path/to/project"
}
```

## Environment Overrides

- `GEMINI_CLI_PATH`: overrides the executable path. Default is `gemini`.
- `GEMINI_PROMPT_FLAG`: overrides the prompt flag. Default is `-p`.
- `GEMINI_MODEL_FLAG`: overrides the model flag. Default is `--model`.

These overrides are intended to keep the server thin while still tolerating local CLI differences.

## Development

```bash
npm test
npm run lint
```

## Notes

- The MCP server does not implement Gemini authentication.
- The server intentionally preserves raw process output so callers can inspect failures.
- If the local Gemini CLI is missing or broken, the tool returns a structured failure with the underlying spawn or runtime error details.
- `executeTask` is the recommended entry point for upstream AI systems because it is optimized to return a final answer instead of raw agent chatter.
