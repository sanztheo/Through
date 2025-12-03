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

  // Filesystem operations
  readFile: (filePath: string) => ipcRenderer.invoke("fs:read-file", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:write-file", { filePath, content }),
  exists: (filePath: string) => ipcRenderer.invoke("fs:exists", filePath),
  readDir: (dirPath: string) => ipcRenderer.invoke("fs:read-dir", dirPath),
});

console.log("Preload script loaded");
