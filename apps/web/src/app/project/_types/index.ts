export interface ServerInstance {
  id: string;
  command: string;
  status: "idle" | "starting" | "running" | "error";
  logs: string[];
  url?: string;
}

export interface DevToolsLog {
  message: string;
  type: string;
  source: string;
  line: number;
}
