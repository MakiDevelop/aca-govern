import { appendFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import type { GateContext, GateResult, PipelineResult } from "./types.js";

export class AuditLog {
  constructor(private path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }

  record(ctx: GateContext, result: PipelineResult): void {
    this.append({
      timestamp: new Date().toISOString(),
      method: ctx.method,
      tool_name: ctx.toolName,
      verdict: result.verdict,
      gate_results: result.gate_results,
      args_hash: hash(ctx.params)
    });
  }

  recordStderr(chunk: string): void {
    this.append({ timestamp: new Date().toISOString(), stream: "child_stderr", data_hash: hash(chunk), bytes: Buffer.byteLength(chunk) });
  }

  private append(entry: unknown): void {
    appendFileSync(this.path, `${JSON.stringify(entry)}\n`, "utf8");
  }
}

export const auditGateResult = (): GateResult => ({ verdict: "allow", gate: "audit" });

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
