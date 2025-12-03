import type {
  ProjectAnalysis,
  ServerInstance,
  ChromiumInstance,
  ChromiumConfig,
} from "@through/shared";

export interface ElectronAPI {
  // Project operations
  selectFolder: () => Promise<string | null>;
  analyzeProject: (
    path: string,
  ) => Promise<ProjectAnalysis & { fromCache: boolean }>;
  invalidateCache: (path: string) => Promise<{ success: boolean }>;

  // Server operations
  startServer: (
    projectPath: string,
    command: string,
    port: number,
  ) => Promise<ServerInstance>;
  stopServer: (serverId: string) => Promise<{ success: boolean }>;
  getServer: (serverId: string) => Promise<ServerInstance | null>;
  getAllServers: () => Promise<ServerInstance[]>;

  // Server events
  onServerReady: (callback: (server: ServerInstance) => void) => void;
  onServerStopped: (callback: (serverId: string) => void) => void;

  // Chromium browser operations
  launchChromium: (config?: any) => Promise<ChromiumInstance>;
  navigateChromium: (instanceId: string, url: string) => Promise<boolean>;
  closeChromium: (instanceId: string) => Promise<boolean>;

  // Filesystem operations
  readFile: (
    filePath: string,
  ) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (
    filePath: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string }>;
  exists: (filePath: string) => Promise<boolean>;
  readDir: (
    dirPath: string,
  ) => Promise<{ success: boolean; files?: string[]; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
