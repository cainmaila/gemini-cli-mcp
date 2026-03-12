<div align="center">
  <img src="./assets/banner.svg" alt="Gemini CLI MCP Banner" width="100%" />

# 🤖 Gemini CLI MCP Server

_Seamless AI-to-AI Delegation via Local Gemini CLI_

[![npm version](https://img.shields.io/npm/v/@cainmaila/gemini-cli-mcp.svg?style=flat-square)](https://www.npmjs.org/package/@cainmaila/gemini-cli-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/gemini-cli-mcp.svg?style=flat-square)](#requirements)

[**English**](./README.md) · [**繁體中文**](./README.zh-TW.md)

</div>

---

## 🌟 Why Gemini CLI MCP?

`gemini-cli-mcp` is an advanced Model Context Protocol (MCP) server that empowers your AI assistants by delegating complex tasks to your locally installed Gemini CLI.

Rather than collapsing failures into generic errors, this server returns **structured results along with execution metadata**, making it an essential tool for robust AI-to-AI handoffs and deep debugging.

### ✨ Key Features

- **🚀 Zero-Friction Auth**: Transparently utilizes your existing local Gemini CLI setup and credentials.
- **🔌 Standard MCP Ready**: Runs headless over `stdio`, effortlessly integrating with standard MCP client setups.
- **🛠️ Task-Oriented & Flexible**: Choose `executeTask` for direct answers, or drop down to `executePrompt` for precise control.
- **🎨 Native Image Generation**: Harnesses your local `nanobanana` extension to generate and retrieve images seamlessly.
- **🔍 Environment Inspection**: Instantly discover available commands, extensions, skills, and MCP servers on the local machine.

---

## 📦 Installation

For normal usage, install the published package globally or run it through your package manager. Ensure you have [Node.js 18.18+](https://nodejs.org/) installed along with a configured local Gemini CLI.

```bash
# npm
npm install -g @cainmaila/gemini-cli-mcp

# pnpm
pnpm add -g @cainmaila/gemini-cli-mcp

# one-off execution without a global install
npx -y @cainmaila/gemini-cli-mcp
```

The published package name is `@cainmaila/gemini-cli-mcp`, but the installed executable name is `gemini-cli-mcp`.

If you use `pnpm add -g`, make sure your MCP client can see your `PNPM_HOME`/global bin directory. Some desktop MCP clients do not inherit the same `PATH` as your interactive shell, which can make `gemini-cli-mcp` look missing even though the package is installed.

If you want to work on this repository itself instead of using the published package, use the local development flow in [DEVELOPMENT.md](DEVELOPMENT.md).

---

## 🚀 Quick Start & Usage

### Running the Server

Since this is an MCP server, it is designed to communicate over `stdio` and should be launched by your MCP client.

```bash
gemini-cli-mcp
```

### Client Configuration Example

Add the following to your AI assistant's MCP configuration:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-cli-mcp"
    }
  }
}
```

If your MCP client cannot resolve global binaries reliably, use one of these alternatives instead:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "@cainmaila/gemini-cli-mcp"]
    }
  }
}
```

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "node",
      "args": ["/absolute/path/to/installed/package/build/index.js"]
    }
  }
}
```

Running `gemini-cli-mcp` directly in a terminal is only useful as a smoke test. It will wait for MCP traffic over `stdio`, so it may look idle until a client connects.

---

## 🛠️ Available Tools

<details>
<summary><b><code>executeTask</code> (Recommended)</b></summary>

Best for upstream AI systems. Hands off a task to the Gemini CLI and returns a ready-to-use answer. Auto-applies edit approvals when necessary!

**Input Example:**

```json
{
  "task": "Query today's weather in Taipei and provide a short summary.",
  "expectedOutput": "Direct answer, no intro.",
  "timeoutMs": 180000
}
```

**Output Example:**

```json
{
  "answer": "...",
  "ok": true,
  "stdout": "...",
  "stderr": "...",
  "exitCode": 0,
  "elapsedMs": 23053
}
```

</details>

<details>
<summary><b><code>executePrompt</code></b></summary>

A lower-level interface designed for callers who demand exact prompt control.

**Input Example:**

```json
{
  "prompt": "Summarize the current repository",
  "model": "gemini-2.5-pro",
  "timeoutMs": 60000
}
```

**Output Example:**

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

</details>

<details>
<summary><b><code>executeImageTask</code></b></summary>

Flawless image-generation backed by the local `nanobanana` extension. Bypasses interactive prompts automatically!

**Input Example:**

```json
{
  "prompt": "a cute orange cat portrait, clean light background",
  "count": 1,
  "timeoutMs": 180000
}
```

**Output Example:**

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

</details>

<details>
<summary><b><code>inspectGeminiCli</code></b></summary>

Discover your AI environment's capabilities on the fly. Returns top-level commands, installed extensions, available skills, and configured MCP servers.

**Input Example:**

```json
{
  "includeModelReportedTools": true,
  "timeoutMs": 60000
}
```

</details>

---

## ⚙️ Environment Overrides

Tailor the server to your specific environment simply by setting these variables:

| Variable             | Description                        | Default   |
| -------------------- | ---------------------------------- | --------- |
| `GEMINI_CLI_PATH`    | Path to the Gemini executable      | `gemini`  |
| `GEMINI_PROMPT_FLAG` | The flag used for passing prompts  | `-p`      |
| `GEMINI_MODEL_FLAG`  | The flag used to specify the model | `--model` |

---

## 📚 Notes & Contributing

- **Authentication**: This server relies on your existing local Gemini CLI authentication.
- **Resilience**: If the local CLI is missing or broken, you will receive structured failure details—never a silent crash.
- **Want to build with us?** Check out our developer guide in [DEVELOPMENT.md](DEVELOPMENT.md).

<br/>
<div align="center">
  <i>Built for the next generation of AI collaboration.</i>
</div>
