/**
 * ChatAgentService - Streaming chat with tool visibility for code editing
 * Uses Vercel AI SDK (compatible with Electron CommonJS)
 */
import { streamText, tool, stepCountIs } from "ai";
import { BrowserWindow } from "electron";
import { getModel } from "./settings.js";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { z } from "zod";

// Types
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCallEvent {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResultEvent {
  id: string;
  name: string;
  result: any;
}

// Singleton instance
let chatAgentInstance: ChatAgentService | null = null;

export class ChatAgentService {
  private mainWindow: BrowserWindow | null = null;
  private abortController: AbortController | null = null;
  private projectPath: string = "";

  constructor() {
    console.log("🤖 ChatAgentService initialized");
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      console.log("🛑 Chat aborted");
    }
  }

  private emit(channel: string, data: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private emitToolCall(toolCall: ToolCallEvent) {
    this.emit("chat:tool-call", toolCall);
  }

  private emitToolResult(result: ToolResultEvent) {
    this.emit("chat:tool-result", result);
  }

  private emitChunk(chunk: { type: string; content?: string; done?: boolean }) {
    this.emit("chat:chunk", chunk);
  }

  /**
   * Create tools for file operations using Vercel AI SDK
   */
  private createTools() {
    const projectPath = this.projectPath;
    const emitToolCall = this.emitToolCall.bind(this);
    const emitToolResult = this.emitToolResult.bind(this);

    return {
      readFile: tool({
        description: "Read the content of a file from the project",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file from project root"),
        }),
        execute: async ({ filePath }) => {
          const callId = `read-${Date.now()}`;
          emitToolCall({ id: callId, name: "readFile", args: { filePath } });
          
          try {
            const fullPath = path.isAbsolute(filePath) 
              ? filePath 
              : path.join(projectPath, filePath);
            const content = await fs.readFile(fullPath, "utf-8");
            const result = { content, path: filePath, lines: content.split("\n").length };
            emitToolResult({ id: callId, name: "readFile", result: { success: true, lines: result.lines } });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "readFile", result });
            return result;
          }
        },
      }),

      writeFile: tool({
        description: "Write content to a file in the project. Creates backup automatically.",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
          content: z.string().describe("The new file content"),
          explanation: z.string().describe("Brief explanation of changes made"),
        }),
        execute: async ({ filePath, content, explanation }) => {
          const callId = `write-${Date.now()}`;
          emitToolCall({ id: callId, name: "writeFile", args: { filePath, explanation } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            
            // Create backup
            const backupPath = fullPath + ".chat-backup";
            try {
              const originalContent = await fs.readFile(fullPath, "utf-8");
              await fs.writeFile(backupPath, originalContent, "utf-8");
            } catch {
              // File doesn't exist yet, no backup needed
            }
            
            // Write new content
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            
            const result = { success: true, filePath, explanation, backupPath };
            emitToolResult({ id: callId, name: "writeFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "writeFile", result });
            return result;
          }
        },
      }),

      searchInProject: tool({
        description: "Search for text, class names, or content in project files",
        inputSchema: z.object({
          query: z.string().describe("The text to search for"),
          fileExtensions: z.array(z.string()).optional().describe("File extensions to search, e.g. ['tsx', 'css']"),
        }),
        execute: async ({ query, fileExtensions }) => {
          const callId = `search-${Date.now()}`;
          emitToolCall({ id: callId, name: "searchInProject", args: { query } });
          
          try {
            const extensions = fileExtensions || ["tsx", "jsx", "ts", "js", "css", "scss", "html", "json"];
            const pattern = `**/*.{${extensions.join(",")}}`;
            
            const files = await glob(pattern, {
              cwd: projectPath,
              ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "**/.git/**"],
            });

            const results: Array<{ file: string; lines: number[]; preview: string }> = [];

            for (const file of files.slice(0, 50)) {
              const fullPath = path.join(projectPath, file);
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                if (content.includes(query)) {
                  const lines = content.split("\n");
                  const matchingLines: number[] = [];
                  let preview = "";

                  lines.forEach((line, index) => {
                    if (line.includes(query)) {
                      matchingLines.push(index + 1);
                      if (!preview) {
                        preview = line.trim().substring(0, 80);
                      }
                    }
                  });

                  if (matchingLines.length > 0) {
                    results.push({ file, lines: matchingLines, preview });
                  }
                }
              } catch {
                // Skip unreadable files
              }
            }

            emitToolResult({ id: callId, name: "searchInProject", result: { count: results.length } });
            return results;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "searchInProject", result });
            return result;
          }
        },
      }),

      listFiles: tool({
        description: "List files in a directory to understand project structure",
        inputSchema: z.object({
          directory: z.string().optional().describe("Relative path to directory, defaults to root"),
        }),
        execute: async ({ directory }) => {
          const callId = `list-${Date.now()}`;
          const dir = directory || ".";
          emitToolCall({ id: callId, name: "listFiles", args: { directory: dir } });
          
          try {
            const fullPath = path.join(projectPath, dir);
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            
            const result = entries
              .filter(e => !e.name.startsWith(".") && e.name !== "node_modules")
              .map(e => ({
                name: e.name,
                type: e.isDirectory() ? "directory" : "file",
              }));
            
            emitToolResult({ id: callId, name: "listFiles", result: { count: result.length } });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "listFiles", result });
            return result;
          }
        },
      }),

      createFile: tool({
        description: "Create a new file with initial content",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path for the new file"),
          content: z.string().describe("Initial content for the file"),
        }),
        execute: async ({ filePath, content }) => {
          const callId = `create-${Date.now()}`;
          emitToolCall({ id: callId, name: "createFile", args: { filePath } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            
            // Check if file exists
            try {
              await fs.access(fullPath);
              const result = { error: "File already exists. Use writeFile to modify it." };
              emitToolResult({ id: callId, name: "createFile", result });
              return result;
            } catch {
              // File doesn't exist, good to create
            }
            
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            
            const result = { success: true, filePath };
            emitToolResult({ id: callId, name: "createFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "createFile", result });
            return result;
          }
        },
      }),

      deleteFile: tool({
        description: "Delete a file from the project (creates backup first)",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file to delete"),
        }),
        execute: async ({ filePath }) => {
          const callId = `delete-${Date.now()}`;
          emitToolCall({ id: callId, name: "deleteFile", args: { filePath } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            
            // Create backup
            const backupPath = fullPath + ".deleted-backup";
            const content = await fs.readFile(fullPath, "utf-8");
            await fs.writeFile(backupPath, content, "utf-8");
            
            // Delete file
            await fs.unlink(fullPath);
            
            const result = { success: true, filePath, backupPath };
            emitToolResult({ id: callId, name: "deleteFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "deleteFile", result });
            return result;
          }
        },
      }),
    };
  }

  /**
   * Stream a chat response with tool calls using Vercel AI SDK
   */
  async streamChat(projectPath: string, messages: ChatMessage[]): Promise<{ success: boolean; error?: string }> {
    this.projectPath = projectPath;
    this.abortController = new AbortController();

    console.log("💬 Starting chat stream...");
    console.log("📂 Project:", projectPath);
    console.log("📝 Messages:", messages.length);

    try {
      const tools = this.createTools();
      const model = getModel();

      const systemPrompt = `Tu es un assistant de développement IA intégré dans un IDE.

CAPACITÉS:
- Lire, modifier, créer et supprimer des fichiers de projet
- Rechercher dans le code source
- Explorer la structure du projet

RÈGLES:
1. Toujours lire un fichier AVANT de le modifier
2. Expliquer clairement chaque modification
3. Ne jamais modifier node_modules ou fichiers de config cachés
4. Créer des backups automatiquement

WORKFLOW TYPIQUE:
1. Comprendre la demande
2. Explorer/rechercher les fichiers pertinents  
3. Lire le fichier cible
4. Effectuer la modification
5. Confirmer le changement

Réponds en français sauf si l'utilisateur parle anglais.`;

      // Build messages for AI
      const aiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Use streamText for streaming response
      const response = streamText({
        model,
        messages: aiMessages,
        tools,
        stopWhen: stepCountIs(15),
        abortSignal: this.abortController.signal,
      });

      // Process the stream
      for await (const chunk of response.textStream) {
        if (this.abortController?.signal.aborted) {
          break;
        }
        if (chunk) {
          this.emitChunk({ type: "text", content: chunk });
        }
      }

      // Signal completion
      this.emitChunk({ type: "done", done: true });

      return { success: true };
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("🛑 Chat was aborted");
        return { success: true };
      }
      console.error("❌ Chat error:", error);
      this.emitChunk({ type: "error", content: error.message });
      return { success: false, error: error.message };
    } finally {
      this.abortController = null;
    }
  }
}

// Export singleton getter
export function getChatAgentService(): ChatAgentService {
  if (!chatAgentInstance) {
    chatAgentInstance = new ChatAgentService();
  }
  return chatAgentInstance;
}
