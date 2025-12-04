export type ServerStatus = "starting" | "running" | "stopped" | "error";

export interface ServerInstance {
  id: string;
  projectPath: string;
  command: string;
  pid: number;
  port: number;
  status: ServerStatus;
  startedAt: Date;
  clientIndex?: number; // Optional index for frontend routing
}

export interface ProcessHandle {
  pid: number;
  command: string;
}
