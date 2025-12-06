import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { generateText } from "ai";
import { getModel } from "../settings.js";
import { ChatMessage, Conversation } from "./types.js";

interface HistoryManagerOptions {
  emitHistoryUpdate: (conversations: Conversation[]) => void;
}

export class HistoryManager {
  private emitHistoryUpdate: (conversations: Conversation[]) => void;

  constructor(options: HistoryManagerOptions) {
    this.emitHistoryUpdate = options.emitHistoryUpdate;
  }

  private getHistoryDir(projectPath: string) {
    const hash = crypto.createHash("md5").update(projectPath).digest("hex");
    return path.join(process.cwd(), "cache", "chat", hash);
  }

  async getConversations(projectPath: string): Promise<Conversation[]> {
    try {
      const dir = this.getHistoryDir(projectPath);
      await fs.mkdir(dir, { recursive: true });

      const files = await fs.readdir(dir);
      const conversations: Conversation[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const content = await fs.readFile(path.join(dir, file), "utf-8");
            conversations.push(JSON.parse(content));
          } catch (e) {
            console.error(`Failed to read conversation ${file}`, e);
          }
        }
      }

      // Sort by timestamp desc
      return conversations.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error("Failed to get conversations", error);
      return [];
    }
  }

  async saveConversation(projectPath: string, conversation: Conversation): Promise<void> {
    try {
      const dir = this.getHistoryDir(projectPath);
      await fs.mkdir(dir, { recursive: true });

      const filePath = path.join(dir, `${conversation.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(conversation, null, 2), "utf-8");

      // Emit update
      this.emitHistoryUpdate(await this.getConversations(projectPath));
    } catch (error) {
      console.error("Failed to save conversation", error);
    }
  }

  async deleteConversation(projectPath: string, conversationId: string): Promise<void> {
    try {
      const dir = this.getHistoryDir(projectPath);
      const filePath = path.join(dir, `${conversationId}.json`);
      await fs.unlink(filePath);

      // Emit update
      this.emitHistoryUpdate(await this.getConversations(projectPath));
    } catch (error) {
      console.error("Failed to delete conversation", error);
    }
  }

  async generateTitle(messages: ChatMessage[]): Promise<string> {
    try {
      const userMessages = messages.filter(m => m.role === "user");
      if (userMessages.length === 0) return "New Conversation";

      const lastMessage = userMessages[userMessages.length - 1].content;

      // Use the model to generate a title
      const { text } = await generateText({
        model: getModel(),
        prompt: `Generate a very short, concise title (max 5 words) for a conversation that starts with this user message. respond ONLY with the title, no quotes.\n\nMessage: ${lastMessage.substring(0, 500)}`,
      });

      return text.trim();
    } catch (error) {
      console.error("Failed to generate title", error);
      return "Conversation";
    }
  }
}
