<div align="center">
  <img src="./assets/banner.svg" alt="Gemini CLI MCP Banner" width="100%" />

  # 🤖 Gemini CLI MCP Server

  *輕量、無縫的 AI 本地代理協作工具*

  [![npm version](https://img.shields.io/npm/v/gemini-cli-mcp.svg?style=flat-square)](https://www.npmjs.org/package/gemini-cli-mcp)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
  [![Node.js Version](https://img.shields.io/node/v/gemini-cli-mcp.svg?style=flat-square)](#要求條件)

  [**English**](./README.md) · [**繁體中文**](./README.zh-TW.md)
</div>

---

## 🌟 為什麼選擇 Gemini CLI MCP？

`gemini-cli-mcp` 是一個強大的 Model Context Protocol (MCP) 伺服器，能讓你的 AI 助理將複雜的任務直接委託給本地安裝的 Gemini CLI。

本伺服器不會在遇到錯誤時只拋出籠統的例外訊息，而是會將 **結構化的執行結果與完整的執行 Metadata** 一併回傳。這使得它成為處理「AI 委託另一位 AI」場景，並且進行深度除錯時不可或缺的利器。

### ✨ 核心亮點

- **🚀 零摩擦認證**：直接運用你本地端現有的 Gemini CLI 設定與驗證授權，隨插即穿。
- **🔌 完美接軌標準 MCP**：透過 `stdio` 無頭 (Headless) 運行，完美契合標準的 MCP 客戶端架構。
- **🛠️ 任務導向設計**：提供 `executeTask` 以獲取直接答案，也能使用降級介面 `executePrompt` 來獲得精準的 Prompt 控制權。
- **🎨 原生圖片生成支援**：無縫接軌本地端的 `nanobanana` 擴充套件，輕鬆生成圖像並回傳路徑。
- **🔍 深度環境檢測**：一鍵掃描當前本地端可用的 Gemini CLI 指令、擴充套件、Skills 以及設定檔中的 MCP Server。

---

## 📦 安裝說明

開始使用非常簡單。請確認你已安裝了 [Node.js 18.18+](https://nodejs.org/) 以及配置好並能自動運行的本地端 Gemini CLI 驗證。

```bash
# 安裝相依套件
npm install

# 編譯專案
npm run build
```

---

## 🚀 快速上手與使用方法

### 啟動伺服器

由於這是一個 MCP 伺服器，它被設計成透過 `stdio` 溝通，並且應該由你的 MCP 客戶端應用程式來啟動：

```bash
node build/index.js
```

### MCP 客戶端設定範例

將以下配置加入你所使用的 AI 助理之 MCP 設定檔中：

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "node",
      "args": ["/絕對路徑/到/你的/gemini-cli-mcp/build/index.js"]
    }
  }
}
```

如果將此伺服器打包或安裝在其他地方，請確保用戶端指向編譯好的 `build/index.js`。

---

## 🛠️ 強大的可用工具 (Tools)

<details>
<summary><b><code>executeTask</code>（最推薦使用）</b></summary>

這是上游 AI 系統的最佳預設工具。當你需要 Gemini CLI 幫你完成一項任務並直接回傳解答時，選這個就對了！如果任務牽涉修改檔案，伺服器還會自動啟用 Auto-Edit 核准模式。

**輸入範例：**
```json
{
  "task": "請查詢台北市今天的天氣，並用繁體中文簡短回答：天氣概況、溫度、降雨機率、以及一個外出建議。",
  "expectedOutput": "直接回答，不要寫前言。",
  "timeoutMs": 180000
}
```

**輸出範例：**
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
</details>

<details>
<summary><b><code>executePrompt</code></b></summary>

專為需要精確控制 Prompt 參數的呼叫者所準備的底層介面。

**輸入範例：**
```json
{
  "prompt": "Summarize the current repository",
  "model": "gemini-2.5-pro",
  "timeoutMs": 60000
}
```

**輸出範例：**
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

支援本地 `nanobanana` 擴充套件的穩健圖片生成介面。預設會啟用 YOLO 模式以自動繞過互動式認證提示，實現全自動生成！

**輸入範例：**
```json
{
  "prompt": "一隻可愛的橘貓肖像，乾淨明亮的背景",
  "count": 1,
  "timeoutMs": 180000
}
```

**輸出範例：**
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

用來動態探索本地 Gemini CLI 環境的利器。它會掃描並回報頂層指令、擴充套件、可用 Skills 以及所有的 MCP 伺服器狀態。

**輸入範例：**
```json
{
  "includeModelReportedTools": true,
  "timeoutMs": 60000
}
```
</details>

---

## ⚙️ 進階環境變數 (Overrides)

若需要客製化伺服器行為，你可以設定以下環境變數：

| 變數名稱 | 說明 | 預設值 |
|----------|-------------|---------|
| `GEMINI_CLI_PATH` | 覆蓋 Gemini CLI 執行檔路徑 | `gemini` |
| `GEMINI_PROMPT_FLAG` | 覆蓋傳遞 Prompt 使用的 Flag | `-p` |
| `GEMINI_MODEL_FLAG` | 覆蓋指定外部模型的 Flag | `--model` |

---

## 📚 注意事項與貢獻

- **身份驗證**：本伺服器底層直接依賴你本地主機已設定好的 Gemini CLI 授權。
- **強健的除錯機制**：如果本地的 Gemini CLI 發生問題或遺失配置，工具將回傳包含詳細狀態細節的 Json 物件，而不是無聲無息的崩潰。
- **想參與開發？** 請詳閱 [DEVELOPMENT.md](DEVELOPMENT.md) 開發者文件。

<br/>
<div align="center">
  <i>專為下一代 AI 代理協作而生。</i>
</div>
