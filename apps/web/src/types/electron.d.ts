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
  ) => Promise<ProjectAnalysis & { fromCache: boolean; commands: string[] }>;
  invalidateCache: (path: string) => Promise<{ success: boolean }>;
  listProjectFiles: (path: string) => Promise<FileNode[]>;
  suggestCommands: (path: string) => Promise<string[]>;
  validateCommand: (
    path: string,
    command: string,
  ) => Promise<{ valid: boolean; corrected: string; issues: string[] }>;
  saveCommands: (
    path: string,
    commands: string[],
  ) => Promise<{ success: boolean }>;

  // Server operations
  startServer: (
    projectPath: string,
    command: string,
    port: number,
    index?: number,
  ) => Promise<ServerInstance>;
  stopServer: (serverId: string) => Promise<{ success: boolean }>;
  stopAllServers: () => Promise<{ success: boolean }>;
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

  // BrowserView tab operations
  createTab: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    url?: string;
  }) => Promise<{
    success: boolean;
    tabId: string;
    title: string;
    url: string;
  }>;
  switchTab: (
    tabId: string,
    bounds?: { x: number; y: number; width: number; height: number },
  ) => Promise<{ success: boolean }>;
  closeTab: (tabId: string) => Promise<{ success: boolean }>;
  getTabs: () => Promise<{
    success: boolean;
    tabs: Array<{
      id: string;
      title: string;
      url: string;
      isActive: boolean;
    }>;
  }>;
  onTabUpdated: (
    callback: (data: { id: string; title: string; url: string }) => void,
  ) => void;

  // Legacy BrowserView operations (backward compatibility)
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
  goBackBrowserView: () => Promise<{ success: boolean; canGoBack: boolean }>;
  goForwardBrowserView: () => Promise<{
    success: boolean;
    canGoForward: boolean;
  }>;
  canNavigateBrowserView: () => Promise<{
    success: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
  }>;

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
  renameFile: (
    oldPath: string,
    newPath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  // Element Inspector
  toggleInspector: (enabled: boolean) => Promise<void>;
  inspectElement: (
    selector: string,
  ) => Promise<{
    matched: boolean;
    info?: {
      tag: string;
      id: string;
      className: string;
      attributes: Record<string, string>;
      rect: { x: number; y: number; width: number; height: number };
      computedStyle: Record<string, string>;
      selector: string;
      innerHTML?: string;
    };
  }>;
  highlightElement: (selector: string) => Promise<boolean>;
  modifyElement: (selector: string, modifications: any) => Promise<boolean>;
  onElementSelected: (callback: (data: any) => void) => void;

  // Agent
  runAgent: (
    prompt: string,
    context: any,
  ) => Promise<{ success: boolean; message: string; data?: any }>;
  acceptAgentChange: (backupPath: string) => Promise<{ success: boolean }>;
  rejectAgentChange: (backupPath: string) => Promise<{ success: boolean }>;
  previewOriginal: (backupPath: string) => Promise<{ success: boolean }>;
  previewModified: (backupPath: string) => Promise<{ success: boolean }>;

  // Settings
  getSettings: () => Promise<{ settings: any; models: any[] }>;
  setSettings: (settings: { aiModel?: string }) => Promise<void>;

  // Chat
  streamChat: (projectPath: string, messages: Array<{ role: string; content: string }>) => Promise<void>;
  onChatChunk: (callback: (chunk: any) => void) => () => void;

  // Git operations
  selectFolderForClone: () => Promise<string | null>;
  cloneRepo: (url: string, destPath: string) => Promise<{
    success: boolean;
    projectPath: string;
    projectName: string;
    error?: string;
  }>;
  onCloneProgress: (callback: (progress: {
    stage: string;
    percent?: number;
    message: string;
  }) => void) => () => void;

  // Setup/Install operations
  installDependencies: (projectPath: string) => Promise<{
    success: boolean;
    packageManager: string;
    error?: string;
  }>;
  cancelInstall: () => Promise<{ success: boolean }>;
  onInstallProgress: (callback: (progress: {
    stage: string;
    percent?: number;
    message: string;
    packageManager?: string;
  }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
