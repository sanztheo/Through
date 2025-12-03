import { ipcMain } from "electron";
import { ServerManager } from "../services/ServerManager";

export function registerServerHandlers() {
  const serverManager = new ServerManager();

  ipcMain.handle(
    "server:start",
    async (
      event,
      data: { projectPath: string; command: string; port: number },
    ) => {
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
  serverManager.on("server:ready", (server) => {
    event.sender.send("server:ready", server);
  });

  serverManager.on("server:stopped", (serverId) => {
    event.sender.send("server:stopped", serverId);
  });

  // Stop all servers on app quit
  ipcMain.on("app:quit", async () => {
    await serverManager.stopAllServers();
  });

  console.log("Server IPC handlers registered");
}
