export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  title: string;
  timestamp: string; // ISO date
  messages: ChatMessage[];
}

export interface ToolCallEvent {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResultEvent {
  id: string;
  name: string;
  result: any;
}

// Pending change for validation/rejection
export interface PendingChange {
  id: string;
  type: "create" | "modify" | "delete";
  filePath: string;
  backupPath?: string;
  timestamp: Date;
}
