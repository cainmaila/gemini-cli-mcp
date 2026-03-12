# gemini-cli-mcp

gemini-cli-mcp is an MCP server that delegates work to your locally installed Gemini CLI and returns both the final result and the execution metadata to the MCP client.

It is designed for AI-to-AI delegation scenarios where another assistant wants to hand off a task, get a direct answer back, and still retain enough process detail for debugging.

## Why Use It

- Uses your existing local Gemini CLI installation and authentication
- Runs headless over stdio, so it fits standard MCP client setups
- Returns structured results instead of collapsing failures into generic errors
- Provides a task-oriented interface for direct answers and a lower-level prompt interface when you need exact control
- Supports image generation through the local nanobanana extension
- Can inspect the local Gemini CLI environment to see available commands, extensions, skills, and MCP servers

## Requirements

- Node.js 18.18 or newer
- A locally installed Gemini CLI that can run unattended
- Gemini authentication already completed on the local machine

## Install

```bash
npm install
npm run build
```

## Run

```bash
node build/index.js
```

The server communicates over stdio and is meant to be launched by an MCP client.

## MCP Client Setup

Example MCP server entry:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "node",
      "args": ["/absolute/path/to/gemini-cli-mcp/build/index.js"]
    }
  }
}
```

If you package or install this elsewhere, point the client to the built entry file at `build/index.js`.

## Available Tools

### `executeTask`

Recommended default for upstream AI systems. Use this when you want Gemini CLI to complete a task and return a directly usable answer.

Example input:

```json
{
  "task": "請查詢台北市今天的天氣，並用繁體中文簡短回答：天氣概況、溫度、降雨機率、以及一個外出建議。",
  "expectedOutput": "直接回答，不要寫前言。",
  "timeoutMs": 180000
}
```

Example output:

```json
{
  "answer": "台北今天多雲到晴，約 11°C 至 19°C，降雨機率低，建議早晚加外套。",
  "ok": true,
  "stdout": "...",
  "stderr": "...",
  "exitCode": 0,
  "elapsedMs": 23053
}
```

When the task appears to modify files, the server automatically uses `--approval-mode auto_edit` unless the caller explicitly overrides it.

### `executePrompt`

Lower-level interface for callers that want exact prompt control.

Example input:

```json
{
  "prompt": "Summarize the current repository",
  "model": "gemini-2.5-pro",
  "timeoutMs": 60000
}
```

Example output:

```json
{
  "ok": true,
  "finalText": "...",
  "stdout": "...",
  "stderr": "",
  "exitCode": 0,
  "elapsedMs": 1532
}
```

### `executeImageTask`

Stable image-generation interface backed by the local nanobanana extension.

This tool enables the `nanobanana` extension automatically and defaults to `approvalMode: "yolo"` so headless image generation can complete without interactive approval prompts.

Example input:

```json
{
  "prompt": "a cute orange cat portrait, clean light background",
  "count": 1,
  "timeoutMs": 180000
}
```

Example output:

```json
{
  "ok": true,
  "responseText": "/path/to/project/nanobanana-output/cat.png",
  "imagePaths": ["/path/to/project/nanobanana-output/cat.png"],
  "primaryImagePath": "/path/to/project/nanobanana-output/cat.png",
  "exitCode": 0,
  "elapsedMs": 12000
}
```

### `inspectGeminiCli`

Use this to discover what the local Gemini CLI environment can currently use.

It reports:

- top-level Gemini CLI commands
- installed extensions
- available skills
- configured MCP servers
- an optional model-reported summary of active tools
- a structured `modelReportedSummary` with extracted built-in tool names, extensions, skills, and MCP server names

Example input:

```json
{
  "includeModelReportedTools": true,
  "timeoutMs": 60000
}
```

## Environment Overrides

- `GEMINI_CLI_PATH`: overrides the executable path. Default is `gemini`.
- `GEMINI_PROMPT_FLAG`: overrides the prompt flag. Default is `-p`.
- `GEMINI_MODEL_FLAG`: overrides the model flag. Default is `--model`.

## Notes

- This server does not implement Gemini authentication.
- If the local Gemini CLI is missing or broken, tool calls return structured failure details.
- `executeTask` is the best general-purpose entry point for most AI delegation use cases.
- `executeImageTask` is the best entry point when the caller needs file paths for generated images.
- `inspectGeminiCli` is useful before delegating specialized tasks that depend on extensions, skills, or MCP servers.

## Development

Development and contributor documentation is available in [DEVELOPMENT.md](DEVELOPMENT.md).
