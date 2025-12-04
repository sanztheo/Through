import { ipcMain } from "electron";
import { ServerManager } from "../services/ServerManager";

export function registerServerHandlers() {
  const serverManager = new ServerManager();
  let mainWindowWebContents: Electron.WebContents | null = null;

  ipcMain.handle(
    "server:start",
    async (
      event,
      data: {
        projectPath: string;
        command: string;
        port: number;
        index?: number;
      },
    ) => {
      mainWindowWebContents = event.sender;
      console.log(`IPC: Starting server for ${data.projectPath}`);
      const server = await serverManager.startServer(
        data.projectPath,
        data.command,
        data.port,
        data.index, // Pass index to ServerManager
      );

      // Return server with index for client-side mapping
      return { ...server, clientIndex: data.index };
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
    if (mainWindowWebContents) {
      mainWindowWebContents.send("server:log", logData);
    }
  });

  // Stop all servers on app quit
  ipcMain.on("app:quit", async () => {
    await serverManager.stopAllServers();
  });

  console.log("Server IPC handlers registered");
}
