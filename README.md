# aca-govern

> Add governance to any MCP server — one line, zero code changes.

Part of the [Agent Civilization Architecture (ACA)](https://github.com/MakiDevelop/agent-civilization-architecture) ecosystem.

## The Problem

MCP lets agents use tools. But there's no standard way to audit what tools they use, limit which tools they can call, or enforce governance policies. MCP servers run with whatever the agent asks for — no questions asked.

`aca-govern` wraps any existing MCP server with a governance proxy. Every tool call passes through a pipeline of gates before reaching the server.

## Quick Start

```bash
# Before: no governance
npx my-mcp-server

# After: with governance
npx aca-govern -- npx my-mcp-server
```

In your MCP client config (Claude Desktop, Cursor, Windsurf, Codex):

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["aca-govern", "--", "npx", "my-mcp-server"]
    }
  }
}
```

That's it. Every tool call is now audited, and you can add allowlists, rate limits, and more.

## What It Does

```
MCP Client (Claude/Cursor)
        │
        │ stdin/stdout
        ▼
┌─────────────────────┐
│   aca-govern        │
│                     │
│   1. Audit Log ✅   │  ← append-only JSONL, every call logged
│   2. Allowlist  ✅  │  ← glob patterns: allow/deny tools
│   3. Rate Limit ✅  │  ← per-minute / per-tool limits
│   4. Tool Classify  │  ← schema-based memory tool detection
│                     │
└────────┬────────────┘
         │ stdin/stdout
         ▼
┌─────────────────────┐
│  Your MCP Server    │
│  (unchanged)        │
└─────────────────────┘
```

### Governance Gates

| Gate | What it does | Always on? |
|------|-------------|------------|
| **Audit Log** | Logs every tool call to JSONL (timestamp, tool, verdict) | Yes — mandatory, cannot be disabled |
| **Tool Allowlist** | Glob-pattern allow/deny for tool names | Optional |
| **Rate Limit** | Sliding window per-minute and per-tool limits | Optional |
| **Tool Classify** | Intercepts `tools/list` to classify tools by schema | Always on |

### Governance Modes

| Mode | Behavior |
|------|----------|
| `enforce` (default) | Denied calls are blocked — client gets a JSON-RPC error |
| `audit_only` | Everything passes, but violations are logged — safe for testing |

## Configuration

Create `.aca-govern.json` (or pass `--config <path>`):

```json
{
  "audit": {
    "enabled": true,
    "path": "~/.aca/audit.jsonl",
    "redact_patterns": ["password", "token", "secret"]
  },
  "tools": {
    "allow": ["*"],
    "deny": ["delete_*", "drop_*"]
  },
  "rate_limit": {
    "enabled": true,
    "max_calls_per_minute": 60,
    "max_calls_per_tool": 10
  },
  "mode": "enforce"
}
```

### CLI Options

```
aca-govern [options] -- <command...>

Options:
  --config <path>       Config file (default: .aca-govern.json)
  --audit-path <path>   Audit log path (default: ~/.aca/audit.jsonl)
  --mode <mode>         enforce | audit_only (default: enforce)
  --version             Print version
```

## Audit Log Format

Append-only JSONL at `~/.aca/audit.jsonl`:

```jsonl
{"ts":"2026-06-15T12:00:00Z","method":"tools/call","tool":"search_web","verdict":"allow","gates":["audit","allowlist","rate_limit"]}
{"ts":"2026-06-15T12:00:01Z","method":"tools/call","tool":"delete_file","verdict":"deny","reason":"tool_denied"}
```

## ACA Ecosystem

`aca-govern` is the second pillar of the ACA protocol ecosystem:

| Product | Purpose |
|---------|---------|
| [Agent Memory Hall](https://github.com/MakiDevelop/agent-memory-hall) | ACA L1-3: Memory + Trust + Identity server |
| **aca-govern** | Governance proxy: add ACA governance to any MCP server |
| [ACA Spec](https://github.com/MakiDevelop/agent-civilization-architecture) | The open protocol specification (6 layers + 34 conformance tests) |

## Roadmap

- [x] Stdio proxy with audit logging
- [x] Tool allowlist/denylist (glob)
- [x] Rate limiting
- [x] Schema-based tool classification
- [x] `audit_only` mode
- [ ] Anti-Ouroboros for memory tools
- [ ] Source tier tagging
- [ ] AMH integration (full ACA L1-3)
- [ ] HTTP/SSE transport
- [ ] Human approval flow

## License

Apache 2.0
