import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
let prompt = "";
let model = "";

for (let index = 0; index < args.length; index += 1) {
  const current = args[index];
  const next = args[index + 1];

  if ((current === "-p" || current === "--prompt") && next) {
    prompt = next;
  }

  if ((current === "--model" || current === "-m") && next) {
    model = next;
  }
}

const scenario = process.env.FAKE_GEMINI_SCENARIO ?? "success";

if (scenario === "success") {
  process.stderr.write("simulated stderr\n");
  process.stdout.write(`model=${model || "default"}\nprompt=${prompt}\n`);
  process.exit(0);
}

if (scenario === "fail") {
  process.stderr.write(`simulated failure for prompt=${prompt}\n`);
  process.exit(17);
}

if (scenario === "sleep") {
  await delay(2_000);
  process.stdout.write(`slept for prompt=${prompt}\n`);
  process.exit(0);
}

process.stderr.write(`unknown scenario: ${scenario}\n`);
process.exit(2);
