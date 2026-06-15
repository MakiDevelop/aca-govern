import { minimatch } from "minimatch";
import type { Gate, GateContext, GateResult } from "./types.js";

export class AllowlistGate implements Gate {
  name = "allowlist";
  evaluate(ctx: GateContext): GateResult {
    const name = ctx.toolName ?? "";
    if (!name) return { verdict: "allow", gate: this.name };
    if (ctx.config.tools.deny.some((p) => minimatch(name, p))) {
      return { verdict: "deny", gate: this.name, reason: "tool_denied" };
    }
    if (!ctx.config.tools.allow.some((p) => minimatch(name, p))) {
      return { verdict: "deny", gate: this.name, reason: "tool_not_allowed" };
    }
    return { verdict: "allow", gate: this.name };
  }
}
