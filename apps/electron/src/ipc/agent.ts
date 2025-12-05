import { ipcMain, BrowserWindow } from "electron";
import { runCodeAgent, acceptChange, rejectChange, ElementInfo } from "../services/codeAgent.js";
import { getSettings, saveSettings, AI_MODELS } from "../services/settings.js";

export function registerAgentHandlers() {
  console.log("Registering Agent IPC handlers...");

  // Run the AI code agent
  ipcMain.handle(
    "agent:run",
    async (
      event,
      data: {
        projectPath: string;
        elementInfo: ElementInfo;
        userPrompt: string;
      }
    ) => {
      console.log("🤖 IPC: Running code agent...");
      
      try {
        const result = await runCodeAgent({
          projectPath: data.projectPath,
          elementInfo: data.elementInfo,
          userPrompt: data.userPrompt,
        });

        console.log("🤖 Agent result:", result.success ? "Success" : "Failed");
        return result;
      } catch (error: any) {
        console.error("❌ Agent IPC error:", error);
        return {
          success: false,
          message: "Agent failed to execute",
          error: error.message,
        };
      }
    }
  );

  // Accept a pending change (delete backup, keep modification)
  ipcMain.handle("agent:accept", async (event, backupPath: string) => {
    console.log("✅ IPC: Accepting change...");
    return await acceptChange(backupPath);
  });

  // Reject a pending change (restore from backup)
  ipcMain.handle("agent:reject", async (event, backupPath: string) => {
    console.log("❌ IPC: Rejecting change...");
    return await rejectChange(backupPath);
  });

  // Get settings
  ipcMain.handle("settings:get", async () => {
    return {
      settings: getSettings(),
      models: AI_MODELS,
    };
  });

  // Save settings
  ipcMain.handle("settings:set", async (event, settings: { aiModel?: string }) => {
    return saveSettings(settings);
  });

  console.log("✅ Agent IPC handlers registered");
}
