# Development Guide

This document is for contributors and maintainers of gemini-cli-mcp.

## Local Development

Install dependencies and build:

```bash
npm install
npm run build
```

Run the server locally:

```bash
npm run build
node build/index.js
```

Run in development mode:

```bash
npm run dev
```

## Validation

```bash
npm test
npm run lint
```

## Project Notes

- The server is intentionally thin and delegates execution to the local Gemini CLI.
- Transport concerns live separately from Gemini execution concerns.
- Structured failures should preserve `stdout`, `stderr`, exit state, and timing.
- User input should be validated before being passed to Gemini CLI.
- Use direct argument passing instead of shell interpolation whenever possible.

## Current MCP Tools

- `executeTask`
- `executePrompt`
- `executeImageTask`
- `inspectGeminiCli`

## Packaging Notes

- Build output is emitted into `build/`.
- The published executable entry is `build/index.js`.
- The package `bin` name is `gemini-cli-mcp`.
