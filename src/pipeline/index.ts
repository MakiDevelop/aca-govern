import type { GovernConfig } from "../config.js";
import { auditGateResult, AuditLog } from "./audit.js";
import { AllowlistGate } from "./allowlist.js";
import { RateLimitGate } from "./rate-limit.js";
import type { Gate, GateContext, PipelineResult, ToolClassification } from "./types.js";

export class GovernancePipeline {
  private gates: Gate[];
  readonly audit: AuditLog;

  constructor(private config: GovernConfig, gates?: Gate[]) {
    this.gates = gates ?? [new AllowlistGate(), new RateLimitGate()];
    this.audit = new AuditLog(config.audit.path);
  }

  evaluate(method: string, params: Record<string, unknown>, toolClassification?: ToolClassification): PipelineResult {
    const ctx: GateContext = {
      method,
      params,
      toolName: typeof params.name === "string" ? params.name : undefined,
      toolClassification,
      config: this.config
    };
    const gate_results = [auditGateResult()];
    let result: PipelineResult = { verdict: "allow", gate_results };
    for (const gate of this.gates) {
      const gateResult = gate.evaluate(ctx);
      gate_results.push(gateResult);
      if (gateResult.verdict === "deny") {
        result = { verdict: this.config.mode === "audit_only" ? "audit_only" : "deny", gate_results, reason: gateResult.reason };
        break;
      }
    }
    this.audit.record(ctx, result);
    return result;
  }
}
