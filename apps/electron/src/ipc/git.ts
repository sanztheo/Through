import { ipcMain, dialog, BrowserWindow } from "electron";
import { gitManager } from "../services/GitManager.js";
import { setupAgent } from "../services/SetupAgent.js";

export function registerGitHandlers(mainWindow: BrowserWindow) {
  console.log("Registering Git IPC handlers...");

  // Set the main window for progress events
  gitManager.setMainWindow(mainWindow);
  setupAgent.setMainWindow(mainWindow);

  // Select folder for cloning
  ipcMain.handle("git:select-folder", async () => {
    console.log("📂 IPC: Selecting folder for clone...");
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: "Sélectionner le dossier de destination",
      buttonLabel: "Sélectionner",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Clone a repository
  ipcMain.handle(
    "git:clone",
    async (
      event,
      data: {
        url: string;
        destPath: string;
      }
    ) => {
      console.log(`🔄 IPC: Cloning ${data.url} to ${data.destPath}`);

      try {
        // Check if git is available
        const gitAvailable = await gitManager.isGitAvailable();
        if (!gitAvailable) {
          return {
            success: false,
            projectPath: "",
            projectName: "",
            error: "Git n'est pas installé sur ce système",
          };
        }

        const result = await gitManager.cloneRepository(data.url, data.destPath);
        return result;
      } catch (error: any) {
        console.error("❌ Git clone IPC error:", error);
        return {
          success: false,
          projectPath: "",
          projectName: "",
          error: error.message,
        };
      }
    }
  );

  // Install dependencies
  ipcMain.handle("setup:install-deps", async (event, projectPath: string) => {
    console.log(`📦 IPC: Installing dependencies in ${projectPath}`);

    try {
      const result = await setupAgent.installDependencies(projectPath);
      return result;
    } catch (error: any) {
      console.error("❌ Install deps IPC error:", error);
      return {
        success: false,
        packageManager: "unknown",
        error: error.message,
      };
    }
  });

  // Cancel installation
  ipcMain.handle("setup:cancel", async () => {
    console.log("🛑 IPC: Cancelling installation...");
    setupAgent.cancel();
    return { success: true };
  });

  console.log("✅ Git IPC handlers registered");
}
