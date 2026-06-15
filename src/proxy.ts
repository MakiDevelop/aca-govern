import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { GovernConfig } from "./config.js";
import { GovernancePipeline } from "./pipeline/index.js";
import { ToolClassifier } from "./pipeline/tool-classify.js";

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
}

export interface ProxyIO {
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
}

export function runProxy(command: string, args: string[], config: GovernConfig, io: ProxyIO = {}): Promise<number> {
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
  return runWithChild(child, config, io);
}

export function runWithChild(child: ChildProcessWithoutNullStreams, config: GovernConfig, io: ProxyIO = {}): Promise<number> {
  const input = io.stdin ?? process.stdin;
  const output = io.stdout ?? process.stdout;
  const errors = io.stderr ?? process.stderr;
  const pipeline = new GovernancePipeline(config);
  const classifier = new ToolClassifier();
  const listToolRequests = new Set<string | number | null>();

  const clientLines = createInterface({ input });
  clientLines.on("line", (line) => {
    const parsed = parseLine(line, output);
    if (!parsed) return;
    if (parsed.method === "tools/list" && "id" in parsed) listToolRequests.add(parsed.id ?? null);
    if (parsed.method === "tools/call") {
      const params = parsed.params ?? {};
      const toolName = typeof params.name === "string" ? params.name : undefined;
      const verdict = pipeline.evaluate("tools/call", params, toolName ? classifier.get(toolName) : undefined);
      if (verdict.verdict === "deny") {
        output.write(`${JSON.stringify(jsonRpcError(parsed.id, verdict.reason ?? "governance_denied"))}\n`);
        return;
      }
    }
    child.stdin.write(`${JSON.stringify(parsed)}\n`);
  });
  clientLines.on("close", () => child.stdin.end());

  createInterface({ input: child.stdout }).on("line", (line) => {
    const msg = safeJson(line);
    if (msg && "id" in msg && listToolRequests.has(msg.id ?? null)) classifier.classifyToolsResponse(msg as { result?: { tools?: unknown[] } });
    output.write(`${line}\n`);
  });

  child.stderr.on("data", (chunk: Buffer) => pipeline.audit.recordStderr(chunk.toString("utf8")));
  child.on("error", (err) => errors.write(`aca-govern child error: ${err.message}\n`));
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

function parseLine(line: string, output: Writable): JsonRpcMessage | undefined {
  const msg = safeJson(line);
  if (!msg) {
    output.write(`${JSON.stringify(jsonRpcError(null, "invalid_json"))}\n`);
    return undefined;
  }
  return msg;
}

function safeJson(line: string): JsonRpcMessage | undefined {
  try {
    const msg = JSON.parse(line) as JsonRpcMessage;
    return msg && typeof msg === "object" ? msg : undefined;
  } catch {
    return undefined;
  }
}

function jsonRpcError(id: JsonRpcMessage["id"], message: string): JsonRpcMessage {
  return { jsonrpc: "2.0", id: id ?? null, error: { code: -32000, message } };
}
