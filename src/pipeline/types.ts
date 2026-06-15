import type { GovernConfig } from "../config.js";

export type Verdict = "allow" | "deny" | "audit_only";
export type ToolClassification = "memory_write" | "memory_read" | "tool_call" | "unknown";

export interface GateResult { verdict: Verdict; gate: string; reason?: string }

export interface GateContext {
  method: string;
  params: Record<string, unknown>;
  toolName?: string;
  toolClassification?: ToolClassification;
  config: GovernConfig;
}

export interface Gate { name: string; evaluate(ctx: GateContext): GateResult }

export interface PipelineResult { verdict: Verdict; gate_results: GateResult[]; reason?: string }
