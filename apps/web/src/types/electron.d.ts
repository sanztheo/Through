import type { ProjectAnalysis, ServerInstance } from "@through/shared";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

export interface ElectronAPI {
  // Project operations
  selectFolder: () => Promise<string | null>;
  analyzeProject: (
    path: string,
  ) => Promise<ProjectAnalysis & { fromCache: boolean }>;
  invalidateCache: (path: string) => Promise<{ success: boolean }>;
  listProjectFiles: (path: string) => Promise<FileNode[]>;
  suggestCommands: (path: string) => Promise<string[]>;
  validateCommand: (
    path: string,
    command: string,
  ) => Promise<{ valid: boolean; corrected: string; issues: string[] }>;

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
  onServerLog: (
    callback: (logData: { id: string; log: string; type: string }) => void,
  ) => void;
  onBrowserConsoleLog: (
    callback: (logData: {
      message: string;
      type: string;
      source: string;
      line: number;
    }) => void,
  ) => void;

  // BrowserView operations for embedded preview
  createBrowserView: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<{ success: boolean }>;
  navigateBrowserView: (url: string) => Promise<{ success: boolean }>;
  setBrowserViewBounds: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<{ success: boolean }>;
  openBrowserViewDevTools: () => Promise<{ success: boolean }>;
  closeBrowserViewDevTools: () => Promise<{ success: boolean }>;
  destroyBrowserView: () => Promise<{ success: boolean }>;
  reloadBrowserView: () => Promise<{ success: boolean }>;

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
