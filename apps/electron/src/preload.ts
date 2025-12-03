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

  // Server operations
  startServer: (projectPath: string, command: string, port: number) =>
    ipcRenderer.invoke("server:start", { projectPath, command, port }),
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

  // Chromium browser operations
  launchChromium: (config?: any) =>
    ipcRenderer.invoke("chromium:launch", config),
  navigateChromium: (instanceId: string, url: string) =>
    ipcRenderer.invoke("chromium:navigate", { instanceId, url }),
  executeChromiumJs: (instanceId: string, script: string) =>
    ipcRenderer.invoke("chromium:execute-js", { instanceId, script }),
  takeChromiumScreenshot: (instanceId: string, outputPath: string) =>
    ipcRenderer.invoke("chromium:screenshot", { instanceId, outputPath }),
  getChromiumContent: (instanceId: string) =>
    ipcRenderer.invoke("chromium:get-content", instanceId),
  closeChromium: (instanceId: string) =>
    ipcRenderer.invoke("chromium:close", instanceId),

  // Filesystem operations
  readFile: (filePath: string) => ipcRenderer.invoke("fs:read-file", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:write-file", { filePath, content }),
  exists: (filePath: string) => ipcRenderer.invoke("fs:exists", filePath),
  readDir: (dirPath: string) => ipcRenderer.invoke("fs:read-dir", dirPath),
});

console.log("Preload script loaded");
