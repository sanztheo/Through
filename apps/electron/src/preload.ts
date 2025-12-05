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
  stopAllServers: () => ipcRenderer.invoke("server:stop-all"),

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

  // BrowserView tab operations
  createTab: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    url?: string;
  }) => ipcRenderer.invoke("browserview:create-tab", bounds, bounds.url),
  switchTab: (
    tabId: string,
    bounds?: { x: number; y: number; width: number; height: number },
  ) => ipcRenderer.invoke("browserview:switch-tab", tabId, bounds),
  closeTab: (tabId: string) =>
    ipcRenderer.invoke("browserview:close-tab", tabId),
  getTabs: () => ipcRenderer.invoke("browserview:get-tabs"),
  onTabUpdated: (
    callback: (data: { id: string; title: string; url: string }) => void,
  ) => {
    ipcRenderer.on("browserview:tab-updated", (_, data) => callback(data));
  },

  // Legacy BrowserView operations (backward compatibility)
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
  goBackBrowserView: () => ipcRenderer.invoke("browserview:go-back"),
  goForwardBrowserView: () => ipcRenderer.invoke("browserview:go-forward"),
  canNavigateBrowserView: () => ipcRenderer.invoke("browserview:can-navigate"),

  // Filesystem operations
  readFile: (filePath: string) => ipcRenderer.invoke("fs:read-file", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:write-file", { filePath, content }),
  exists: (filePath: string) => ipcRenderer.invoke("fs:exists", filePath),
  readDir: (dirPath: string) => ipcRenderer.invoke("fs:read-dir", dirPath),

  // Element Inspector
  toggleInspector: (enabled: boolean) =>
    ipcRenderer.invoke("browserview:toggle-inspector", enabled),
  onElementSelected: (
    callback: (elementInfo: {
      tagName: string;
      id: string | null;
      className: string | null;
      selector: string;
      rect: {
        x: number;
        y: number;
        width: number;
        height: number;
        top: number;
        left: number;
        right: number;
        bottom: number;
      };
      computedStyle: Record<string, string>;
      attributes: Array<{ name: string; value: string }>;
      textContent: string | null;
      childCount: number;
      parentTag: string | null;
    }) => void,
  ) => {
    ipcRenderer.on("inspector:element-selected", (_, elementInfo) => {
      callback(elementInfo);
    });
  },
  onInspectorCancelled: (callback: () => void) => {
    ipcRenderer.on("inspector:cancelled", () => {
      callback();
    });
  },
});

console.log("Preload script loaded");
