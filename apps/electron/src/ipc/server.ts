import { ipcMain } from "electron";
import { ServerManager } from "../services/ServerManager";

export function registerServerHandlers() {
  const serverManager = new ServerManager();
  let mainWindowWebContents: Electron.WebContents | null = null;

  ipcMain.handle(
    "server:start",
    async (
      event,
      data: { projectPath: string; command: string; port: number },
    ) => {
      mainWindowWebContents = event.sender;
      console.log(`IPC: Starting server for ${data.projectPath}`);
      const server = await serverManager.startServer(
        data.projectPath,
        data.command,
        data.port,
      );
      return server;
    },
  );

  ipcMain.handle("server:stop", async (event, serverId: string) => {
    console.log(`IPC: Stopping server ${serverId}`);
    await serverManager.stopServer(serverId);
    return { success: true };
  });

  ipcMain.handle("server:get", async (event, serverId: string) => {
    const server = serverManager.getServer(serverId);
    return server || null;
  });

  ipcMain.handle("server:get-all", async () => {
    return serverManager.getAllServers();
  });

  // Forward server events to renderer
  serverManager.on("server:ready", async (server) => {
    if (mainWindowWebContents) {
      mainWindowWebContents.send("server:ready", server);
    }
  });

  serverManager.on("server:stopped", (serverId) => {
    if (mainWindowWebContents) {
      mainWindowWebContents.send("server:stopped", serverId);
    }
  });

  serverManager.on("server:log", (logData) => {
    console.log("📤 Forwarding log to renderer:", logData);
    if (mainWindowWebContents) {
      mainWindowWebContents.send("server:log", logData);
      console.log("✅ Log sent to renderer");
    } else {
      console.error("❌ mainWindowWebContents is null, cannot send log");
    }
  });

  // Stop all servers on app quit
  ipcMain.on("app:quit", async () => {
    await serverManager.stopAllServers();
  });

  console.log("Server IPC handlers registered");
}
