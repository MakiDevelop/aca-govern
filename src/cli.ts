#!/usr/bin/env node
import { loadConfig, type GovernConfig } from "./config.js";
import { runProxy } from "./proxy.js";

const VERSION = "0.1.0";

interface Args {
  configPath?: string;
  auditPath?: string;
  mode?: GovernConfig["mode"];
  command: string[];
}

function parseArgv(argv: string[]): Args {
  const sep = argv.indexOf("--");
  const flags = sep >= 0 ? argv.slice(0, sep) : argv;
  const command = sep >= 0 ? argv.slice(sep + 1) : [];
  const parsed: Args = { command };
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    if (flag === "--version") {
      console.log(VERSION);
      process.exit(0);
    }
    if (flag === "--config") parsed.configPath = requireValue(flags, ++i, flag);
    else if (flag === "--audit-path") parsed.auditPath = requireValue(flags, ++i, flag);
    else if (flag === "--mode") parsed.mode = requireValue(flags, ++i, flag) as GovernConfig["mode"];
    else usage(`unknown option: ${flag}`);
  }
  return parsed;
}

function requireValue(values: string[], index: number, flag: string): string {
  if (!values[index]) usage(`${flag} requires a value`);
  return values[index];
}

function usage(message?: string): never {
  if (message) console.error(`aca-govern: ${message}`);
  console.error("Usage: aca-govern [--config path] [--audit-path path] [--mode enforce|audit_only] -- <command...>");
  process.exit(2);
}

const args = parseArgv(process.argv.slice(2));
if (args.command.length === 0) usage("missing wrapped MCP server command after --");
const config = loadConfig({ configPath: args.configPath, auditPath: args.auditPath, mode: args.mode });
const code = await runProxy(args.command[0], args.command.slice(1), config);
process.exit(code);
