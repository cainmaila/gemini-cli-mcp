# gemini-cli-mcp

This project provides an MCP server that delegates work to a locally installed Gemini CLI and returns a meaningful final answer plus execution metadata to the MCP caller.

## What It Does

- Exposes four MCP tools: `executeTask` for AI-friendly task delegation, `executePrompt` for low-level prompt control, `executeImageTask` for nanobanana-backed image generation, and `inspectGeminiCli` for runtime capability inspection
- Runs Gemini CLI in a non-interactive mode using direct argument passing
- Captures `stdout`, `stderr`, `exitCode`, `signal`, `elapsedMs`, timeout state, and abort state
- Returns failures as structured tool results instead of collapsing them into generic errors
- Makes `executeTask` return a direct final answer, so upstream AI systems can use the result without additional prompt wrapping
- Automatically switches file-mutating delegated tasks to `--approval-mode auto_edit` unless the caller explicitly overrides it

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

When the task looks like it will create, overwrite, rename, move, or otherwise modify files, the server automatically adds `--approval-mode auto_edit` to avoid headless executions stalling on edit confirmations. You can still override this with an explicit `approvalMode`.

Input:

```json
{
  "task": "請查詢台北市今天的天氣，並用繁體中文簡短回答：天氣概況、溫度、降雨機率、以及一個外出建議。",
  "expectedOutput": "直接回答，不要寫前言。",
  "approvalMode": "default",
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

File-writing example:

```json
{
  "task": "建立一個 cat.svg 檔案並寫入一張極簡貓咪 SVG 圖。",
  "cwd": "/path/to/project",
  "timeoutMs": 180000
}
```

In this case the server will automatically execute Gemini CLI with `--approval-mode auto_edit`.

### `executePrompt`

Use this low-level interface when the caller wants to control the exact Gemini prompt directly.

Input:

```json
{
  "prompt": "Summarize the current repository",
  "model": "gemini-2.5-pro",
  "approvalMode": "default",
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

### `executeImageTask`

Use this when the caller wants a stable image-generation interface backed by the local nanobanana extension.

This tool always runs Gemini CLI with the `nanobanana` extension enabled and defaults to `approvalMode: "yolo"` so the underlying image-generation tool call can complete in headless mode.

Input:

```json
{
  "prompt": "a cute orange cat portrait, clean light background",
  "count": 1,
  "styles": ["watercolor"],
  "cwd": "/path/to/project",
  "timeoutMs": 180000
}
```

Structured output shape:

```json
{
  "ok": true,
  "responseText": "/path/to/project/nanobanana-output/cat.png",
  "imagePaths": ["/path/to/project/nanobanana-output/cat.png"],
  "primaryImagePath": "/path/to/project/nanobanana-output/cat.png",
  "stdout": "...",
  "stderr": "...",
  "exitCode": 0,
  "elapsedMs": 12000,
  "command": "gemini",
  "args": [
    "-e",
    "nanobanana",
    "--approval-mode",
    "yolo",
    "--output-format",
    "json",
    "-p",
    "..."
  ]
}
```

### `inspectGeminiCli`

Use this when the caller needs to know what the local Gemini CLI can currently use.

It inspects:

- top-level Gemini CLI commands from `gemini --help`
- installed extensions from `gemini extensions list`
- discovered skills from `gemini skills list --all`
- configured MCP servers from `gemini mcp list`
- an optional model-reported summary of active tools via a headless prompt probe
- a structured `modelReportedSummary` that extracts built-in tool names, extensions, skills, and MCP server names from the model-reported summary text

Input:

```json
{
  "includeModelReportedTools": true,
  "timeoutMs": 60000
}
```

Structured output shape:

```json
{
  "version": "0.33.0",
  "commands": [
    { "command": "gemini mcp", "description": "Manage MCP servers" }
  ],
  "extensions": [{ "name": "nanobanana", "version": "1.0.10" }],
  "skills": [{ "name": "svg-art", "enabled": true, "builtIn": false }],
  "mcpServers": [
    {
      "name": "context7",
      "target": "https://mcp.context7.com/mcp",
      "transport": "http",
      "status": "Connected"
    }
  ],
  "modelReportedTools": "...optional summary...",
  "modelReportedSummary": {
    "builtInTools": ["read_file", "write_file"],
    "extensions": ["nanobanana"],
    "skills": ["svg-art"],
    "mcpServers": ["context7"]
  },
  "notes": [],
  "raw": {
    "help": "...",
    "extensions": "...",
    "skills": "...",
    "mcpServers": "..."
  }
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
- `executeImageTask` is the recommended entry point when the caller specifically wants generated image file paths instead of free-form text.
- `inspectGeminiCli` is the recommended way to discover the local CLI's currently installed extensions, skills, and configured MCP servers before delegating specialized tasks such as image generation.
