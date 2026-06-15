import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { defaultConfig, type GovernConfig } from "./config.js";
import { runWithChild } from "./proxy.js";

test("audit logging records tool calls", async () => {
  const { audit, output } = await runScenario({ messages: [call("allowed")] });
  assert.equal(output.length, 1);
  const entry = firstAudit(audit);
  assert.equal(entry.method, "tools/call");
  assert.equal(entry.tool_name, "allowed");
  assert.equal(entry.verdict, "allow");
  assert.ok(entry.args_hash);
});

test("allowlist denies disallowed tools with JSON-RPC error", async () => {
  const { output } = await runScenario({ config: { tools: { allow: ["safe"], deny: [] } }, messages: [call("unsafe")] });
  assert.equal(output[0].error.message, "tool_not_allowed");
});

test("rate limit denies N+1th call", async () => {
  const { output } = await runScenario({
    config: { rate_limit: { enabled: true, max_calls_per_minute: 1, max_calls_per_tool: 1 } },
    messages: [call("safe", 1), call("safe", 2)]
  });
  assert.equal(output.find((msg) => msg.id === 1)?.result.name, "safe");
  assert.equal(output.find((msg) => msg.id === 2)?.error.message, "rate_limit_exceeded");
});

test("audit_only forwards denied calls but logs audit_only verdict", async () => {
  const { audit, output } = await runScenario({
    config: { mode: "audit_only", tools: { allow: ["safe"], deny: [] } },
    messages: [call("unsafe")]
  });
  assert.equal(output[0].result.name, "unsafe");
  assert.equal(firstAudit(audit).verdict, "audit_only");
});

type PartialConfig = Partial<{
  [K in keyof GovernConfig]: GovernConfig[K] extends object ? Partial<GovernConfig[K]> : GovernConfig[K];
}>;

async function runScenario(opts: { messages: unknown[]; config?: PartialConfig }): Promise<{ audit: string; output: any[] }> {
  const dir = mkdtempSync(join(tmpdir(), "aca-govern-"));
  const server = join(dir, "mock-server.mjs");
  const audit = join(dir, "audit.jsonl");
  writeFileSync(server, mockServerSource(), "utf8");
  const child = spawn(process.execPath, [server], { stdio: ["pipe", "pipe", "pipe"] });
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const chunks: string[] = [];
  stdout.on("data", (chunk) => chunks.push(chunk.toString("utf8")));
  const config = merge(defaultConfig(), { audit: { path: audit }, ...(opts.config ?? {}) });
  const done = runWithChild(child, config, { stdin, stdout });
  for (const msg of opts.messages) stdin.write(`${JSON.stringify(msg)}\n`);
  stdin.end();
  await done;
  return { audit, output: chunks.join("").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) };
}

function call(name: string, id = 1): unknown {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: { value: "secret" } } };
}

function firstAudit(path: string): any {
  return JSON.parse(readFileSync(path, "utf8").trim().split("\n")[0]);
}

function merge(base: GovernConfig, input: PartialConfig): GovernConfig {
  return {
    ...base,
    ...input,
    audit: { ...base.audit, ...input.audit },
    tools: { ...base.tools, ...input.tools },
    rate_limit: { ...base.rate_limit, ...input.rate_limit }
  };
}

function mockServerSource(): string {
  return `import{createInterface}from"node:readline";
console.error("mock stderr");
createInterface({input:process.stdin}).on("line",(line)=>{
const msg=JSON.parse(line);
if(msg.method==="tools/call")process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:msg.id,result:{name:msg.params.name}})+"\\n");
});`;
}
