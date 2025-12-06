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

  console.log("✅ Chat IPC handlers registered");
}
