import type { CallToolOptions, CallToolResult, ToolArgs } from "./types.ts";

export async function callTool(
  _name: string,
  _args: ToolArgs,
  _options?: CallToolOptions,
): Promise<CallToolResult> {
  return { ok: false, data: null, errorMessage: "Connectors not configured" };
}
