import type { Gate, GateContext, GateResult } from "./types.js";

export class RateLimitGate implements Gate {
  name = "rate_limit";
  private all: number[] = [];
  private byTool = new Map<string, number[]>();

  evaluate(ctx: GateContext): GateResult {
    if (!ctx.config.rate_limit.enabled || ctx.method !== "tools/call") return { verdict: "allow", gate: this.name };
    const now = Date.now();
    this.all = trim(this.all, now);
    const tool = ctx.toolName ?? "unknown";
    const toolCalls = trim(this.byTool.get(tool) ?? [], now);
    if (this.all.length >= ctx.config.rate_limit.max_calls_per_minute || toolCalls.length >= ctx.config.rate_limit.max_calls_per_tool) {
      return { verdict: "deny", gate: this.name, reason: "rate_limit_exceeded" };
    }
    this.all.push(now);
    toolCalls.push(now);
    this.byTool.set(tool, toolCalls);
    return { verdict: "allow", gate: this.name };
  }
}

function trim(values: number[], now: number): number[] {
  return values.filter((t) => now - t < 60_000);
}
