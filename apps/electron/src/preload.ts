import { contextBridge, ipcRenderer } from "electron";

// Fix "global is not defined" error in Electron renderer
(globalThis as any).global = globalThis;

// Expose safe, curated API to renderer
contextBridge.exposeInMainWorld("electronAPI", {
  // Project operations
  selectFolder: () => ipcRenderer.invoke("project:select-folder"),
  analyzeProject: (path: string) => ipcRenderer.invoke("project:analyze", path),
  invalidateCache: (path: string) =>
    ipcRenderer.invoke("project:invalidate-cache", path),
  listProjectFiles: (path: string) =>
    ipcRenderer.invoke("project:list-files", path),
  suggestCommands: (path: string) =>
    ipcRenderer.invoke("project:suggest-commands", path),
  validateCommand: (path: string, command: string) =>
    ipcRenderer.invoke("project:validate-command", path, command),
  saveCommands: (path: string, commands: string[]) =>
    ipcRenderer.invoke("project:save-commands", path, commands),

  // Server operations
  startServer: (
    projectPath: string,
    command: string,
    port: number,
    index?: number,
  ) =>
    ipcRenderer.invoke("server:start", { projectPath, command, port, index }),
  stopServer: (serverId: string) => ipcRenderer.invoke("server:stop", serverId),
  getServer: (serverId: string) => ipcRenderer.invoke("server:get", serverId),
  getAllServers: () => ipcRenderer.invoke("server:get-all"),

  // Server events (streaming)
  onServerReady: (callback: (server: any) => void) => {
    ipcRenderer.on("server:ready", (_, server) => callback(server));
  },
  onServerStopped: (callback: (serverId: string) => void) => {
    ipcRenderer.on("server:stopped", (_, serverId) => callback(serverId));
  },
  onServerLog: (
    callback: (logData: { id: string; log: string; type: string }) => void,
  ) => {
    ipcRenderer.on("server:log", (_, logData) => {
      console.log("📥 Preload received server:log event:", logData);
      callback(logData);
    });
  },
  onBrowserConsoleLog: (
    callback: (logData: {
      message: string;
      type: string;
      source: string;
      line: number;
    }) => void,
  ) => {
    ipcRenderer.on("browser:console-log", (_, logData) => {
      console.log("📥 Preload received browser:console-log event:", logData);
      callback(logData);
    });
  },

  // BrowserView operations for embedded preview
  createBrowserView: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => ipcRenderer.invoke("browserview:create", bounds),
  navigateBrowserView: (url: string) =>
    ipcRenderer.invoke("browserview:navigate", url),
  setBrowserViewBounds: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => ipcRenderer.invoke("browserview:set-bounds", bounds),
  openBrowserViewDevTools: () =>
    ipcRenderer.invoke("browserview:open-devtools"),
  closeBrowserViewDevTools: () =>
    ipcRenderer.invoke("browserview:close-devtools"),
  destroyBrowserView: () => ipcRenderer.invoke("browserview:destroy"),
  reloadBrowserView: () => ipcRenderer.invoke("browserview:reload"),

  // Filesystem operations
  readFile: (filePath: string) => ipcRenderer.invoke("fs:read-file", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:write-file", { filePath, content }),
  exists: (filePath: string) => ipcRenderer.invoke("fs:exists", filePath),
  readDir: (dirPath: string) => ipcRenderer.invoke("fs:read-dir", dirPath),
});

console.log("Preload script loaded");
