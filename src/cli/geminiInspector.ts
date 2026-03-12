import { runGeminiCommand } from "./geminiCommandRunner.js";
import type {
  GeminiCliCommandInfo,
  GeminiCliExtensionInfo,
  GeminiCliInspectionResult,
  GeminiCliMcpServerInfo,
  GeminiCliModelReportedSummary,
  GeminiCliSkillInfo,
  GeminiCommandInput,
  GeminiExecutionResult,
  GeminiRunnerOptions,
} from "../types.js";

const MODEL_PROBE_PROMPT = [
  "List the currently available Gemini CLI capabilities for this session.",
  "Group the answer into built-in tools, extensions, skills, and MCP servers.",
  "Keep it concise and do not invent unavailable tools.",
].join(" ");

function stripStatusLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "")
    .filter((line) => !line.startsWith("Loaded cached credentials."))
    .filter((line) => !line.startsWith("Loading extension:"))
    .filter(
      (line) =>
        !line.startsWith("Server '") &&
        !line.includes("supports tool updates."),
    )
    .filter((line) => !line.startsWith("[ERROR] [IDEClient]"));
}

function collectIndentedValues(lines: string[], startIndex: number): string[] {
  const values: string[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      break;
    }

    if (!line.startsWith("  ")) {
      break;
    }

    values.push(line.trim());
  }

  return values;
}

export function parseGeminiHelpCommands(
  stdout: string,
): GeminiCliCommandInfo[] {
  const lines = stripStatusLines(stdout);
  const commandsStart = lines.findIndex((line) => line.trim() === "Commands:");

  if (commandsStart === -1) {
    return [];
  }

  const commands: GeminiCliCommandInfo[] = [];
  for (let index = commandsStart + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      break;
    }

    if (!line.trim()) {
      continue;
    }
    if (!line.startsWith("  ")) {
      break;
    }

    const match = line.trim().match(/^(.*?)\s{2,}(.*)$/);
    if (!match) {
      continue;
    }

    const [, command, description] = match;
    if (!command || !description) {
      continue;
    }

    commands.push({
      command: command.trim(),
      description: description.trim(),
    });
  }

  return commands;
}

export function parseGeminiExtensions(
  stdout: string,
): GeminiCliExtensionInfo[] {
  const lines = stripStatusLines(stdout);
  const extensions: GeminiCliExtensionInfo[] = [];
  let current: GeminiCliExtensionInfo | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    const headerMatch = line.match(/^[✓✗]\s+([^\(]+)\(([^\)]+)\)$/);
    if (headerMatch) {
      const [, name, version] = headerMatch;
      if (!name || !version) {
        continue;
      }

      if (current) {
        extensions.push(current);
      }
      current = {
        name: name.trim(),
        version: version.trim(),
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("Path:")) {
      current.path = trimmed.replace(/^Path:\s*/, "");
      continue;
    }
    if (trimmed.startsWith("Source:")) {
      current.source = trimmed.replace(/^Source:\s*/, "");
      continue;
    }
    if (trimmed.startsWith("Enabled (User):")) {
      current.enabledUser =
        trimmed.replace(/^Enabled \(User\):\s*/, "") === "true";
      continue;
    }
    if (trimmed.startsWith("Enabled (Workspace):")) {
      current.enabledWorkspace =
        trimmed.replace(/^Enabled \(Workspace\):\s*/, "") === "true";
      continue;
    }
    if (trimmed === "MCP servers:") {
      current.mcpServers = collectIndentedValues(lines, index);
    }
  }

  if (current) {
    extensions.push(current);
  }

  return extensions;
}

export function parseGeminiSkills(stdout: string): GeminiCliSkillInfo[] {
  const lines = stripStatusLines(stdout);
  const startIndex = lines.findIndex((line) =>
    line.includes("Discovered Agent Skills:"),
  );
  if (startIndex === -1) {
    return [];
  }

  const skills: GeminiCliSkillInfo[] = [];
  let current: GeminiCliSkillInfo | undefined;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      break;
    }

    if (!line.trim()) {
      continue;
    }

    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      if (current) {
        skills.push(current);
      }

      current = {
        name: line.replace(/\s*\[[^\]]+\]/g, "").trim(),
        enabled: line.includes("[Enabled]"),
        builtIn: line.includes("[Built-in]"),
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("Description:")) {
      current.description = trimmed.replace(/^Description:\s*/, "");
      continue;
    }
    if (trimmed.startsWith("Location:")) {
      current.location = trimmed.replace(/^Location:\s*/, "");
    }
  }

  if (current) {
    skills.push(current);
  }

  return skills;
}

export function parseGeminiMcpServers(
  stdout: string,
): GeminiCliMcpServerInfo[] {
  const lines = stripStatusLines(stdout);
  const startIndex = lines.findIndex((line) =>
    line.includes("Configured MCP servers:"),
  );
  if (startIndex === -1) {
    return [];
  }

  const servers: GeminiCliMcpServerInfo[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      break;
    }

    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const match = trimmedLine.match(
      /^[✓✗]\s+([^:]+):\s+(.*)\s+\(([^\)]+)\)\s+-\s+(.+)$/,
    );
    if (!match) {
      continue;
    }

    const [, name, target, transport, status] = match;
    if (!name || !target || !transport || !status) {
      continue;
    }

    servers.push({
      name: name.trim(),
      target: target.trim(),
      transport: transport.trim(),
      status: status.trim(),
    });
  }

  return servers;
}

function parseModelProbe(stdout: string): string | undefined {
  try {
    const payload = JSON.parse(stdout) as { response?: string };
    return payload.response?.trim();
  } catch {
    return undefined;
  }
}

function extractBacktickNames(line: string): string[] {
  return [...line.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function extractBoldNames(line: string): string[] {
  return [...line.matchAll(/\*\*([^*]+)\*\*/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function parseModelReportedSummary(
  text?: string,
): GeminiCliModelReportedSummary | undefined {
  if (!text?.trim()) {
    return undefined;
  }

  const summary: GeminiCliModelReportedSummary = {
    builtInTools: [],
    extensions: [],
    skills: [],
    mcpServers: [],
  };

  let section: keyof GeminiCliModelReportedSummary | undefined;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (/內建工具|Built-in Tools/i.test(line)) {
      section = "builtInTools";
      continue;
    }
    if (/擴充功能|Extensions/i.test(line)) {
      section = "extensions";
      continue;
    }
    if (/技能|Skills/i.test(line)) {
      section = "skills";
      continue;
    }
    if (/MCP 伺服器|MCP Servers/i.test(line)) {
      section = "mcpServers";
      continue;
    }

    if (!section) {
      continue;
    }

    if (section === "builtInTools" || section === "skills") {
      summary[section].push(...extractBacktickNames(line));
      continue;
    }

    summary[section].push(
      ...extractBoldNames(line),
      ...extractBacktickNames(line),
    );
  }

  return {
    builtInTools: unique(summary.builtInTools),
    extensions: unique(summary.extensions),
    skills: unique(summary.skills),
    mcpServers: unique(summary.mcpServers),
  };
}

function preferCommandText(result: GeminiExecutionResult): string {
  return result.stdout.trim() ? result.stdout : result.stderr;
}

export async function inspectGeminiCli(
  input: {
    includeModelReportedTools?: boolean | undefined;
    timeoutMs?: number | undefined;
  } = {},
  runner: (
    input: GeminiCommandInput,
    options?: GeminiRunnerOptions,
  ) => Promise<GeminiExecutionResult> = runGeminiCommand,
  options: GeminiRunnerOptions = {},
): Promise<GeminiCliInspectionResult> {
  const timeoutMs = input.timeoutMs;
  const buildCommandInput = (args: string[]): GeminiCommandInput => ({
    args,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });

  const results = await Promise.all([
    runner(buildCommandInput(["--version"]), options),
    runner(buildCommandInput(["--help"]), options),
    runner(buildCommandInput(["extensions", "list"]), options),
    runner(buildCommandInput(["skills", "list", "--all"]), options),
    runner(buildCommandInput(["mcp", "list"]), options),
    input.includeModelReportedTools !== false
      ? runner(
          buildCommandInput([
            "-p",
            MODEL_PROBE_PROMPT,
            "--output-format",
            "json",
          ]),
          options,
        )
      : Promise.resolve(undefined),
  ]);

  const [
    versionResult,
    helpResult,
    extensionsResult,
    skillsResult,
    mcpResult,
    modelProbeResult,
  ] = results;

  const notes: string[] = [];
  if (!helpResult.ok) {
    notes.push(
      "Failed to read `gemini --help`; top-level commands may be incomplete.",
    );
  }
  if (!extensionsResult.ok) {
    notes.push(
      "Failed to read `gemini extensions list`; extension details may be incomplete.",
    );
  }
  if (!skillsResult.ok) {
    notes.push(
      "Failed to read `gemini skills list --all`; skill details may be incomplete.",
    );
  }
  if (!mcpResult.ok) {
    notes.push(
      "Failed to read `gemini mcp list`; MCP server details may be incomplete.",
    );
  }
  const modelReportedTools = modelProbeResult
    ? parseModelProbe(preferCommandText(modelProbeResult))
    : undefined;
  const modelReportedSummary = parseModelReportedSummary(modelReportedTools);

  if (input.includeModelReportedTools !== false && !modelReportedTools) {
    notes.push(
      "Model-reported tool summary was unavailable; command-based inspection is still returned.",
    );
  }

  const helpText = preferCommandText(helpResult);
  const extensionsText = preferCommandText(extensionsResult);
  const skillsText = preferCommandText(skillsResult);
  const mcpText = preferCommandText(mcpResult);

  return {
    version: versionResult.finalText,
    commands: parseGeminiHelpCommands(helpText),
    extensions: parseGeminiExtensions(extensionsText),
    skills: parseGeminiSkills(skillsText),
    mcpServers: parseGeminiMcpServers(mcpText),
    notes,
    raw: {
      help: helpText,
      extensions: extensionsText,
      skills: skillsText,
      mcpServers: mcpText,
      ...(modelProbeResult
        ? { modelReportedTools: preferCommandText(modelProbeResult) }
        : {}),
    },
    ...(modelReportedTools ? { modelReportedTools } : {}),
    ...(modelReportedSummary ? { modelReportedSummary } : {}),
  };
}
