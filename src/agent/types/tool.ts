import type { ToolDefinition } from './agent';

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

export interface AgentTool extends ToolDefinition {
  handler: ToolHandler;
}
