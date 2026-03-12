import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerGeminiTools,
  type ExecutePromptDependencies,
} from "./mcp/tools.js";
import { SERVER_NAME, SERVER_VERSION } from "./types.js";

export function createServer(dependencies: ExecutePromptDependencies = {}) {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerGeminiTools(server, dependencies);

  return server;
}
