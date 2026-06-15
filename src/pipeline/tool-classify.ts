import type { ToolClassification } from "./types.js";

export class ToolClassifier {
  private classes = new Map<string, ToolClassification>();

  classifyToolsResponse(message: JsonRpcMessage): void {
    const tools = Array.isArray(message.result?.tools) ? message.result.tools : [];
    for (const tool of tools) {
      if (isTool(tool)) this.classes.set(tool.name, classify(tool));
    }
  }

  get(name: string): ToolClassification {
    return this.classes.get(name) ?? "unknown";
  }
}

export interface JsonRpcMessage {
  result?: { tools?: unknown[] };
}

function classify(tool: { name: string; inputSchema?: unknown }): ToolClassification {
  const haystack = `${tool.name} ${JSON.stringify(tool.inputSchema ?? {})}`.toLowerCase();
  const hasMemory = /memory|namespace/.test(haystack);
  const writes = /write|store|set|save|supersede|content/.test(haystack);
  const reads = /read|search|get|list|fetch/.test(haystack);
  if (hasMemory && writes) return "memory_write";
  if (hasMemory && reads) return "memory_read";
  return "tool_call";
}

function isTool(value: unknown): value is { name: string; inputSchema?: unknown } {
  return typeof value === "object" && value !== null && "name" in value && typeof value.name === "string";
}
