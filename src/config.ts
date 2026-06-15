import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export interface GovernConfig {
  audit: { enabled: boolean; path: string; redact_patterns: string[] };
  tools: { allow: string[]; deny: string[] };
  rate_limit: { enabled: boolean; max_calls_per_minute: number; max_calls_per_tool: number };
  mode: "enforce" | "audit_only";
}

export const defaultConfig = (): GovernConfig => ({
  audit: { enabled: true, path: "~/.aca/audit.jsonl", redact_patterns: [] },
  tools: { allow: ["*"], deny: [] },
  rate_limit: { enabled: true, max_calls_per_minute: 60, max_calls_per_tool: 30 },
  mode: "enforce"
});

export interface ConfigOverrides { configPath?: string; auditPath?: string; mode?: GovernConfig["mode"] }

export function expandPath(path: string): string {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path);
}

export function loadConfig(overrides: ConfigOverrides = {}): GovernConfig {
  const cfg = defaultConfig();
  const path = overrides.configPath ?? (existsSync(".aca-govern.json") ? ".aca-govern.json" : undefined);
  if (path) mergeConfig(cfg, JSON.parse(readFileSync(path, "utf8")) as Partial<GovernConfig>);
  if (overrides.auditPath) cfg.audit.path = overrides.auditPath;
  if (overrides.mode) cfg.mode = overrides.mode;
  cfg.audit.enabled = true;
  cfg.audit.path = expandPath(cfg.audit.path);
  validateConfig(cfg);
  return cfg;
}

function mergeConfig(target: GovernConfig, input: Partial<GovernConfig>): void {
  target.audit = { ...target.audit, ...input.audit };
  target.tools = { ...target.tools, ...input.tools };
  target.rate_limit = { ...target.rate_limit, ...input.rate_limit };
  if (input.mode) target.mode = input.mode;
}

function validateConfig(cfg: GovernConfig): void {
  if (cfg.mode !== "enforce" && cfg.mode !== "audit_only") throw new Error("mode must be enforce or audit_only");
  if (!Array.isArray(cfg.tools.allow) || !Array.isArray(cfg.tools.deny)) throw new Error("tools allow/deny must be arrays");
  if (cfg.rate_limit.max_calls_per_minute < 1 || cfg.rate_limit.max_calls_per_tool < 1) throw new Error("rate limits must be positive");
}
