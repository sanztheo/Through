/**
 * Chat IPC Handlers - Streaming chat with AI agent
 */
import { ipcMain, BrowserWindow } from "electron";
import { getChatAgentService } from "../services/ChatAgentService.js";

export function registerChatHandlers(mainWindow: BrowserWindow) {
  console.log("Registering Chat IPC handlers...");

  const chatService = getChatAgentService();
  chatService.setMainWindow(mainWindow);

  // Stream chat messages
  ipcMain.handle(
    "chat:stream",
    async (
      event,
      data: {
        projectPath: string;
        messages: Array<{ role: string; content: string }>;
      }
    ) => {
      console.log(`💬 IPC: Starting chat stream for ${data.projectPath}`);

      try {
        const result = await chatService.streamChat(
          data.projectPath,
          data.messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          }))
        );
        return result;
      } catch (error: any) {
        console.error("❌ Chat stream IPC error:", error);
        return { success: false, error: error.message };
      }
    }
  );

  // Abort current chat
  ipcMain.handle("chat:abort", async () => {
    console.log("🛑 IPC: Aborting chat...");
    chatService.abort();
    return { success: true };
  });

  // Get pending changes
  ipcMain.handle("chat:get-pending-changes", async () => {
    return chatService.getPendingChanges();
  });

  // Validate all changes (keep modifications)
  ipcMain.handle("chat:validate-changes", async () => {
    console.log("✅ IPC: Validating all changes...");
    return await chatService.validateChanges();
  });

  // Reject all changes (restore from backups)
  ipcMain.handle("chat:reject-changes", async () => {
    console.log("❌ IPC: Rejecting all changes...");
    return await chatService.rejectChanges();
  });

  // Clear pending changes without action
  ipcMain.handle("chat:clear-pending-changes", async () => {
    console.log("🗑️ IPC: Clearing pending changes...");
    chatService.clearPendingChanges();
    return { success: true };
  });

  console.log("✅ Chat IPC handlers registered");
}
