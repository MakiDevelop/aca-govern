# aca-govern

```bash
npx aca-govern -- npx my-mcp-server
npx aca-govern --config .aca-govern.json -- npx my-mcp-server
```
It reads newline-delimited JSON-RPC 2.0, gates `tools/call`, returns JSON-RPC errors for denied requests, and writes child stderr only to the append-only audit log.

```json
{
  "audit": { "enabled": true, "path": "~/.aca/audit.jsonl", "redact_patterns": [] },
  "tools": { "allow": ["*"], "deny": [] },
  "rate_limit": { "enabled": true, "max_calls_per_minute": 60, "max_calls_per_tool": 30 },
  "mode": "enforce"
}
```
