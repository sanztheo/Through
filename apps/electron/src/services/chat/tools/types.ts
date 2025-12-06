import { ToolCallEvent, ToolResultEvent, PendingChange } from "../types.js";

export interface ToolContext {
  projectPath: string;
  emitToolCall: (event: ToolCallEvent) => void;
  emitToolResult: (event: ToolResultEvent) => void;
  addPendingChange?: (change: Omit<PendingChange, "id" | "timestamp">) => void;
}
