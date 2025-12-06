/**
 * ChatAgentService - Streaming chat with tool visibility for code editing
 * Uses Vercel AI SDK (compatible with Electron CommonJS)
 */
import { streamText, tool, stepCountIs, generateText } from "ai";
import { BrowserWindow } from "electron";
import { getModel, getModelInfo } from "./settings.js";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";

const execAsync = promisify(exec);

// Types
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  title: string;
  timestamp: string; // ISO date
  messages: ChatMessage[];
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

// Pending change for validation/rejection
export interface PendingChange {
  id: string;
  type: "create" | "modify" | "delete";
  filePath: string;
  backupPath?: string;
  timestamp: Date;
}

// Singleton instance
let chatAgentInstance: ChatAgentService | null = null;

export class ChatAgentService {
  private mainWindow: BrowserWindow | null = null;
  private abortController: AbortController | null = null;
  private projectPath: string = "";
  private pendingChanges: PendingChange[] = [];

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

  // Add a pending change to track
  private addPendingChange(change: Omit<PendingChange, "id" | "timestamp">) {
    const pendingChange: PendingChange = {
      ...change,
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    this.pendingChanges.push(pendingChange);
    this.emitPendingChanges();
    console.log(`📝 Added pending change: ${change.type} ${change.filePath}`);
  }

  // Emit pending changes to frontend
  private emitPendingChanges() {
    this.emit("chat:pending-changes", this.pendingChanges);
  }

  // Get all pending changes
  getPendingChanges(): PendingChange[] {
    return this.pendingChanges;
  }

  // Validate all pending changes (keep modifications, delete backups)
  async validateChanges(): Promise<{ success: boolean }> {
    console.log("✅ Validating all changes...");
    
    for (const change of this.pendingChanges) {
      if (change.backupPath) {
        try {
          await fs.unlink(change.backupPath);
          console.log(`  ✅ Removed backup: ${change.backupPath}`);
        } catch (error) {
          console.error(`  ❌ Failed to remove backup: ${change.backupPath}`, error);
        }
      }
    }
    
    this.pendingChanges = [];
    this.emitPendingChanges();
    return { success: true };
  }

  // Reject all pending changes (restore from backups)
  async rejectChanges(): Promise<{ success: boolean }> {
    console.log("❌ Rejecting all changes...");
    
    for (const change of this.pendingChanges) {
      try {
        if (change.type === "delete" && change.backupPath) {
          // Restore deleted file
          const backupContent = await fs.readFile(change.backupPath, "utf-8");
          await fs.writeFile(change.filePath, backupContent, "utf-8");
          await fs.unlink(change.backupPath);
          console.log(`  ✅ Restored deleted file: ${change.filePath}`);
        } else if (change.type === "modify" && change.backupPath) {
          // Restore modified file
          const backupContent = await fs.readFile(change.backupPath, "utf-8");
          await fs.writeFile(change.filePath, backupContent, "utf-8");
          await fs.unlink(change.backupPath);
          console.log(`  ✅ Restored modified file: ${change.filePath}`);
        } else if (change.type === "create") {
          // Delete created file
          await fs.unlink(change.filePath);
          console.log(`  ✅ Removed created file: ${change.filePath}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to restore: ${change.filePath}`, error);
      }
    }
    
    this.pendingChanges = [];
    this.emitPendingChanges();
    return { success: true };
  }

  // Clear pending changes without action
  clearPendingChanges() {
    this.pendingChanges = [];
    this.emitPendingChanges();
  }

  // ==================== HISTORY MANAGEMENT ====================

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
      this.emit("chat:history-updated", await this.getConversations(projectPath));
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
      this.emit("chat:history-updated", await this.getConversations(projectPath));
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
   * Create all tools for the agent
   */
  private createTools() {
    const projectPath = this.projectPath;
    const emitToolCall = this.emitToolCall.bind(this);
    const emitToolResult = this.emitToolResult.bind(this);
    const addPendingChange = this.addPendingChange.bind(this);

    return {
      // ==================== FILE READING TOOLS ====================
      
      readFile: tool({
        description: "Read the entire content of a file",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
        }),
        execute: async ({ filePath }) => {
          const callId = `read-${Date.now()}`;
          emitToolCall({ id: callId, name: "readFile", args: { filePath } });
          
          try {
            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");
            const result = { content, path: filePath, totalLines: lines.length };
            emitToolResult({ id: callId, name: "readFile", result: { success: true, totalLines: lines.length } });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "readFile", result });
            return result;
          }
        },
      }),

      getLineRange: tool({
        description: "Read specific lines from a file. Perfect for large files - read only what you need.",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
          startLine: z.number().describe("Start line number (1-indexed)"),
          endLine: z.number().describe("End line number (inclusive)"),
        }),
        execute: async ({ filePath, startLine, endLine }) => {
          const callId = `lines-${Date.now()}`;
          emitToolCall({ id: callId, name: "getLineRange", args: { filePath, startLine, endLine } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");
            const selectedLines = lines.slice(startLine - 1, endLine);
            const result = { 
              content: selectedLines.join("\n"), 
              startLine, 
              endLine, 
              totalLines: lines.length 
            };
            emitToolResult({ id: callId, name: "getLineRange", result: { success: true, linesRead: selectedLines.length } });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "getLineRange", result });
            return result;
          }
        },
      }),

      getFileInfo: tool({
        description: "Get file metadata without reading content: size, line count, extension, last modified",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
        }),
        execute: async ({ filePath }) => {
          const callId = `info-${Date.now()}`;
          emitToolCall({ id: callId, name: "getFileInfo", args: { filePath } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            const stats = await fs.stat(fullPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const result = {
              filePath,
              size: stats.size,
              sizeKB: Math.round(stats.size / 1024 * 100) / 100,
              lineCount: content.split("\n").length,
              extension: path.extname(filePath),
              lastModified: stats.mtime.toISOString(),
              isLargeFile: stats.size > 50000,
            };
            emitToolResult({ id: callId, name: "getFileInfo", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "getFileInfo", result });
            return result;
          }
        },
      }),

      // ==================== SEARCH TOOLS ====================

      searchInProject: tool({
        description: "Search for text across ALL project files. Returns matching files with line numbers.",
        inputSchema: z.object({
          query: z.string().describe("Text to search for"),
          fileExtensions: z.array(z.string()).optional().describe("Limit to extensions, e.g. ['tsx', 'css']"),
          maxResults: z.number().optional().describe("Maximum results to return (default 20)"),
        }),
        execute: async ({ query, fileExtensions, maxResults = 20 }) => {
          const callId = `search-${Date.now()}`;
          emitToolCall({ id: callId, name: "searchInProject", args: { query } });
          
          try {
            const extensions = fileExtensions || ["tsx", "jsx", "ts", "js", "css", "scss", "html", "json", "md"];
            const pattern = `**/*.{${extensions.join(",")}}`;
            
            const files = await glob(pattern, {
              cwd: projectPath,
              ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "**/.git/**"],
            });

            const results: Array<{ file: string; matches: Array<{ line: number; content: string }> }> = [];

            for (const file of files.slice(0, 100)) {
              const fullPath = path.join(projectPath, file);
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                if (content.includes(query)) {
                  const lines = content.split("\n");
                  const matches: Array<{ line: number; content: string }> = [];
                  
                  lines.forEach((line, index) => {
                    if (line.includes(query)) {
                      matches.push({ line: index + 1, content: line.trim().substring(0, 100) });
                    }
                  });

                  if (matches.length > 0) {
                    results.push({ file, matches: matches.slice(0, 5) });
                  }
                }
              } catch { /* skip */ }
              
              if (results.length >= maxResults) break;
            }

            emitToolResult({ id: callId, name: "searchInProject", result: { found: results.length } });
            return results;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "searchInProject", result });
            return result;
          }
        },
      }),

      searchInFile: tool({
        description: "Search for text WITHIN a specific file. Returns all matching lines with context.",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
          query: z.string().describe("Text to search for"),
          contextLines: z.number().optional().describe("Lines of context around each match (default 2)"),
        }),
        execute: async ({ filePath, query, contextLines = 2 }) => {
          const callId = `searchfile-${Date.now()}`;
          emitToolCall({ id: callId, name: "searchInFile", args: { filePath, query } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");
            
            const matches: Array<{ line: number; content: string; context: string }> = [];
            
            lines.forEach((line, index) => {
              if (line.includes(query)) {
                const start = Math.max(0, index - contextLines);
                const end = Math.min(lines.length, index + contextLines + 1);
                const context = lines.slice(start, end).join("\n");
                matches.push({ 
                  line: index + 1, 
                  content: line.trim(), 
                  context 
                });
              }
            });

            const result = { filePath, query, matches, totalMatches: matches.length };
            emitToolResult({ id: callId, name: "searchInFile", result: { found: matches.length } });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "searchInFile", result });
            return result;
          }
        },
      }),

      searchByRegex: tool({
        description: "Search using regex pattern across project files",
        inputSchema: z.object({
          pattern: z.string().describe("Regex pattern (e.g. 'function\\s+\\w+')"),
          fileExtensions: z.array(z.string()).optional(),
        }),
        execute: async ({ pattern, fileExtensions }) => {
          const callId = `regex-${Date.now()}`;
          emitToolCall({ id: callId, name: "searchByRegex", args: { pattern } });
          
          try {
            const regex = new RegExp(pattern, "g");
            const extensions = fileExtensions || ["tsx", "jsx", "ts", "js"];
            const globPattern = `**/*.{${extensions.join(",")}}`;
            
            const files = await glob(globPattern, {
              cwd: projectPath,
              ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
            });

            const results: Array<{ file: string; matches: string[] }> = [];

            for (const file of files.slice(0, 50)) {
              const fullPath = path.join(projectPath, file);
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                const matches = content.match(regex);
                if (matches && matches.length > 0) {
                  results.push({ file, matches: matches.slice(0, 10) });
                }
              } catch { /* skip */ }
            }

            emitToolResult({ id: callId, name: "searchByRegex", result: { found: results.length } });
            return results;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "searchByRegex", result });
            return result;
          }
        },
      }),

      // ==================== FILE STRUCTURE TOOLS ====================

      listFiles: tool({
        description: "List files and folders in a directory",
        inputSchema: z.object({
          directory: z.string().optional().describe("Relative path to directory (default: root)"),
          recursive: z.boolean().optional().describe("Include subdirectories (default: false)"),
        }),
        execute: async ({ directory, recursive = false }) => {
          const callId = `list-${Date.now()}`;
          const dir = directory || ".";
          emitToolCall({ id: callId, name: "listFiles", args: { directory: dir, recursive } });
          
          try {
            const fullPath = path.join(projectPath, dir);
            
            if (recursive) {
              const files = await glob("**/*", {
                cwd: fullPath,
                ignore: ["**/node_modules/**", "**/.git/**"],
                dot: false,
              });
              const result = files.slice(0, 100).map(f => ({ path: path.join(dir, f) }));
              emitToolResult({ id: callId, name: "listFiles", result: { count: result.length } });
              return result;
            }
            
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            const result = entries
              .filter(e => !e.name.startsWith(".") && e.name !== "node_modules")
              .map(e => ({
                name: e.name,
                type: e.isDirectory() ? "directory" : "file",
                path: path.join(dir, e.name),
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

      getProjectStructure: tool({
        description: "Get the full project tree structure. Useful to understand project layout.",
        inputSchema: z.object({
          maxDepth: z.number().optional().describe("Maximum depth to explore (default: 3)"),
        }),
        execute: async ({ maxDepth = 3 }) => {
          const callId = `structure-${Date.now()}`;
          emitToolCall({ id: callId, name: "getProjectStructure", args: { maxDepth } });
          
          try {
            const pattern = "*".repeat(maxDepth).split("").join("/");
            const files = await glob(`{${pattern},*}`, {
              cwd: projectPath,
              ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.next/**"],
              dot: false,
            });

            // Build tree structure
            const tree: Record<string, any> = {};
            files.forEach(file => {
              const parts = file.split("/");
              let current = tree;
              parts.forEach((part, i) => {
                if (i === parts.length - 1) {
                  current[part] = "file";
                } else {
                  current[part] = current[part] || {};
                  current = current[part];
                }
              });
            });

            emitToolResult({ id: callId, name: "getProjectStructure", result: { files: files.length } });
            return { tree, totalFiles: files.length };
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "getProjectStructure", result });
            return result;
          }
        },
      }),

      findFilesByName: tool({
        description: "Find files by name or pattern (glob)",
        inputSchema: z.object({
          pattern: z.string().describe("Glob pattern like '*.tsx' or 'Button*'"),
        }),
        execute: async ({ pattern }) => {
          const callId = `find-${Date.now()}`;
          emitToolCall({ id: callId, name: "findFilesByName", args: { pattern } });
          
          try {
            const files = await glob(`**/${pattern}`, {
              cwd: projectPath,
              ignore: ["**/node_modules/**", "**/.git/**"],
            });
            
            emitToolResult({ id: callId, name: "findFilesByName", result: { found: files.length } });
            return files.slice(0, 50);
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "findFilesByName", result });
            return result;
          }
        },
      }),

      // ==================== FILE WRITING TOOLS ====================

      writeFile: tool({
        description: "Write ENTIRE content to a file. For small changes, use replaceInFile instead.",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
          content: z.string().describe("The complete new content"),
          explanation: z.string().describe("What changes were made"),
        }),
        execute: async ({ filePath, content, explanation }) => {
          const callId = `write-${Date.now()}`;
          emitToolCall({ id: callId, name: "writeFile", args: { filePath, explanation } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            let isNewFile = true;
            let backupPath: string | undefined;
            
            // Create backup if file exists
            try {
              const original = await fs.readFile(fullPath, "utf-8");
              backupPath = fullPath + ".backup";
              await fs.writeFile(backupPath, original, "utf-8");
              isNewFile = false;
            } catch { /* new file */ }
            
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            
            // Track this change
            addPendingChange({
              type: isNewFile ? "create" : "modify",
              filePath: fullPath,
              backupPath: backupPath,
            });
            
            const result = { success: true, filePath, explanation };
            emitToolResult({ id: callId, name: "writeFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "writeFile", result });
            return result;
          }
        },
      }),

      replaceInFile: tool({
        description: "Replace a specific code block. FASTER than rewriting whole file. Preferred for modifications.",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
          search: z.string().describe("EXACT code to replace (must match perfectly including whitespace)"),
          replace: z.string().describe("New code to insert"),
          explanation: z.string().describe("Why this change is being made"),
        }),
        execute: async ({ filePath, search, replace, explanation }) => {
          const callId = `replace-${Date.now()}`;
          emitToolCall({ id: callId, name: "replaceInFile", args: { filePath, explanation } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            const content = await fs.readFile(fullPath, "utf-8");
            
            const normalizedContent = content.replace(/\r\n/g, "\n");
            const normalizedSearch = search.replace(/\r\n/g, "\n");
            
            if (!normalizedContent.includes(normalizedSearch)) {
              const result = { 
                success: false, 
                error: "Code block not found. Use readFile to get exact content." 
              };
              emitToolResult({ id: callId, name: "replaceInFile", result });
              return result;
            }
            
            // Backup
            const backupPath = fullPath + ".backup";
            await fs.writeFile(backupPath, content, "utf-8");
            
            const newContent = normalizedContent.replace(normalizedSearch, replace);
            await fs.writeFile(fullPath, newContent, "utf-8");
            
            // Track this change
            addPendingChange({
              type: "modify",
              filePath: fullPath,
              backupPath: backupPath,
            });
            
            const result = { success: true, filePath, explanation };
            emitToolResult({ id: callId, name: "replaceInFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "replaceInFile", result });
            return result;
          }
        },
      }),

      insertAtLine: tool({
        description: "Insert content at a specific line number. Great for adding imports, new functions, etc.",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
          lineNumber: z.number().describe("Line number where to insert (1-indexed)"),
          content: z.string().describe("Content to insert"),
          explanation: z.string().describe("What is being added"),
        }),
        execute: async ({ filePath, lineNumber, content, explanation }) => {
          const callId = `insert-${Date.now()}`;
          emitToolCall({ id: callId, name: "insertAtLine", args: { filePath, lineNumber, explanation } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            const fileContent = await fs.readFile(fullPath, "utf-8");
            const lines = fileContent.split("\n");
            
            // Backup
            await fs.writeFile(fullPath + ".backup", fileContent, "utf-8");
            
            // Insert at line
            lines.splice(lineNumber - 1, 0, content);
            await fs.writeFile(fullPath, lines.join("\n"), "utf-8");
            
            const result = { success: true, filePath, lineNumber, explanation };
            emitToolResult({ id: callId, name: "insertAtLine", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "insertAtLine", result });
            return result;
          }
        },
      }),

      appendToFile: tool({
        description: "Add content at the END of a file",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
          content: z.string().describe("Content to append"),
        }),
        execute: async ({ filePath, content }) => {
          const callId = `append-${Date.now()}`;
          emitToolCall({ id: callId, name: "appendToFile", args: { filePath } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            await fs.appendFile(fullPath, "\n" + content, "utf-8");
            
            const result = { success: true, filePath };
            emitToolResult({ id: callId, name: "appendToFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "appendToFile", result });
            return result;
          }
        },
      }),

      // ==================== FILE MANAGEMENT TOOLS ====================

      createFile: tool({
        description: "Create a new file with initial content",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path for the new file"),
          content: z.string().describe("Initial content"),
        }),
        execute: async ({ filePath, content }) => {
          const callId = `create-${Date.now()}`;
          emitToolCall({ id: callId, name: "createFile", args: { filePath } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            
            try {
              await fs.access(fullPath);
              const result = { error: "File already exists. Use writeFile to overwrite." };
              emitToolResult({ id: callId, name: "createFile", result });
              return result;
            } catch { /* good */ }
            
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
        description: "Delete a file (creates backup first)",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file"),
        }),
        execute: async ({ filePath }) => {
          const callId = `delete-${Date.now()}`;
          emitToolCall({ id: callId, name: "deleteFile", args: { filePath } });
          
          try {
            const fullPath = path.join(projectPath, filePath);
            const backupPath = fullPath + ".deleted-backup";
            
            // Backup first
            const content = await fs.readFile(fullPath, "utf-8");
            await fs.writeFile(backupPath, content, "utf-8");
            
            await fs.unlink(fullPath);
            
            // Track this change for validation/rejection
            addPendingChange({
              type: "delete",
              filePath: fullPath,
              backupPath: backupPath,
            });
            
            const result = { success: true, filePath };
            emitToolResult({ id: callId, name: "deleteFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "deleteFile", result });
            return result;
          }
        },
      }),

      copyFile: tool({
        description: "Copy a file to a new location",
        inputSchema: z.object({
          sourcePath: z.string().describe("Source file path"),
          destPath: z.string().describe("Destination file path"),
        }),
        execute: async ({ sourcePath, destPath }) => {
          const callId = `copy-${Date.now()}`;
          emitToolCall({ id: callId, name: "copyFile", args: { sourcePath, destPath } });
          
          try {
            const src = path.join(projectPath, sourcePath);
            const dest = path.join(projectPath, destPath);
            
            await fs.mkdir(path.dirname(dest), { recursive: true });
            await fs.copyFile(src, dest);
            
            const result = { success: true, sourcePath, destPath };
            emitToolResult({ id: callId, name: "copyFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "copyFile", result });
            return result;
          }
        },
      }),

      moveFile: tool({
        description: "Move or rename a file",
        inputSchema: z.object({
          sourcePath: z.string().describe("Current file path"),
          destPath: z.string().describe("New file path"),
        }),
        execute: async ({ sourcePath, destPath }) => {
          const callId = `move-${Date.now()}`;
          emitToolCall({ id: callId, name: "moveFile", args: { sourcePath, destPath } });
          
          try {
            const src = path.join(projectPath, sourcePath);
            const dest = path.join(projectPath, destPath);
            
            await fs.mkdir(path.dirname(dest), { recursive: true });
            await fs.rename(src, dest);
            
            const result = { success: true, sourcePath, destPath };
            emitToolResult({ id: callId, name: "moveFile", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "moveFile", result });
            return result;
          }
        },
      }),

      // ==================== PROJECT INFO TOOLS ====================

      getPackageInfo: tool({
        description: "Read package.json to understand project dependencies and scripts",
        inputSchema: z.object({}),
        execute: async () => {
          const callId = `pkg-${Date.now()}`;
          emitToolCall({ id: callId, name: "getPackageInfo", args: {} });
          
          try {
            const pkgPath = path.join(projectPath, "package.json");
            const content = await fs.readFile(pkgPath, "utf-8");
            const pkg = JSON.parse(content);
            
            const result = {
              name: pkg.name,
              version: pkg.version,
              scripts: pkg.scripts || {},
              dependencies: Object.keys(pkg.dependencies || {}),
              devDependencies: Object.keys(pkg.devDependencies || {}),
            };
            emitToolResult({ id: callId, name: "getPackageInfo", result });
            return result;
          } catch (error: any) {
            const result = { error: error.message };
            emitToolResult({ id: callId, name: "getPackageInfo", result });
            return result;
          }
        },
      }),

      runCommand: tool({
        description: "Run a shell command in the project directory. Use for npm commands, git, etc.",
        inputSchema: z.object({
          command: z.string().describe("Command to run (e.g. 'npm install lodash')"),
          timeout: z.number().optional().describe("Timeout in ms (default: 30000)"),
        }),
        execute: async ({ command, timeout = 30000 }) => {
          const callId = `cmd-${Date.now()}`;
          emitToolCall({ id: callId, name: "runCommand", args: { command } });
          
          // Security: block dangerous commands
          const blocked = ["rm -rf /", "sudo", ":(){ :|:& };:", "mkfs", "dd if="];
          if (blocked.some(b => command.includes(b))) {
            const result = { error: "Command blocked for security reasons" };
            emitToolResult({ id: callId, name: "runCommand", result });
            return result;
          }
          
          try {
            const { stdout, stderr } = await execAsync(command, {
              cwd: projectPath,
              timeout,
            });
            
            const result = { 
              success: true, 
              stdout: stdout.substring(0, 2000), 
              stderr: stderr.substring(0, 500) 
            };
            emitToolResult({ id: callId, name: "runCommand", result: { success: true } });
            return result;
          } catch (error: any) {
            const result = { error: error.message, stderr: error.stderr?.substring(0, 500) };
            emitToolResult({ id: callId, name: "runCommand", result });
            return result;
          }
        },
      }),
    };
  }

  /**
   * Stream a chat response with tool calls
   */
  async streamChat(projectPath: string, messages: ChatMessage[], conversationId?: string): Promise<{ success: boolean; error?: string; conversationId?: string }> {
    this.projectPath = projectPath;
    this.abortController = new AbortController();

    // Setup conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = crypto.randomUUID();
    }

    console.log("💬 Starting chat stream...");
    console.log("📂 Project:", projectPath);
    console.log("🆔 Conversation:", currentConversationId);
    console.log("📝 Messages:", messages.length);

    try {
      const tools = this.createTools();
      const model = getModel();

      const systemPrompt = `Tu es un assistant de développement IA expert, intégré dans un IDE.

## TOOLS DISPONIBLES (18 outils)

### Lecture
- **readFile**: Lire tout un fichier
- **getLineRange**: Lire des lignes spécifiques (optimisé pour gros fichiers)
- **getFileInfo**: Métadonnées d'un fichier (taille, lignes, date)

### Recherche
- **searchInProject**: Chercher du texte dans tout le projet
- **searchInFile**: Chercher dans un fichier spécifique (avec contexte)
- **searchByRegex**: Recherche par expression régulière
- **findFilesByName**: Trouver des fichiers par nom/pattern

### Structure
- **listFiles**: Lister un répertoire
- **getProjectStructure**: Arborescence complète du projet
- **getPackageInfo**: Lire package.json (dépendances, scripts)

### Écriture
- **writeFile**: Réécrire un fichier entier
- **replaceInFile**: Remplacer un bloc de code (PRÉFÉRÉ - rapide & sûr)
- **insertAtLine**: Insérer à une ligne précise
- **appendToFile**: Ajouter à la fin d'un fichier

### Gestion
- **createFile**: Créer un nouveau fichier
- **deleteFile**: Supprimer un fichier (backup auto)
- **copyFile**: Copier un fichier
- **moveFile**: Déplacer/renommer un fichier

### Système
- **runCommand**: Exécuter une commande shell (npm, git, etc.)

## RÈGLES
1. TOUJOURS lire un fichier AVANT de le modifier
2. Pour gros fichiers: utiliser getFileInfo puis getLineRange
3. Préférer replaceInFile à writeFile pour les modifications
4. Expliquer chaque changement
5. Ne JAMAIS modifier node_modules

## WORKFLOW
1. Comprendre la demande
2. Explorer le projet (listFiles, getProjectStructure)
3. Rechercher le code pertinent (searchInProject, searchInFile)
4. Lire le fichier cible (readFile ou getLineRange)
5. Modifier (replaceInFile ou insertAtLine)
6. Confirmer le changement

Réponds en français sauf si l'utilisateur parle anglais.`;

      const aiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Check if extended thinking is enabled
      const modelInfo = getModelInfo();
      console.log("🧠 Extended Thinking enabled:", modelInfo.extendedThinking);
      console.log("📊 Model:", modelInfo.model?.name, "| Provider:", modelInfo.model?.provider, "| Supports thinking:", modelInfo.model?.supportsThinking);

      // Build streamText options
      const streamOptions: any = {
        model,
        messages: aiMessages,
        tools,
        stopWhen: stepCountIs(25),
        abortSignal: this.abortController.signal,
      };

      // Add extended thinking based on provider
      if (modelInfo.extendedThinking && modelInfo.model?.supportsThinking) {
        const provider = modelInfo.model.provider;
        
        if (provider === "anthropic") {
          // Anthropic: Use thinking with budget
          streamOptions.providerOptions = {
            anthropic: {
              thinking: {
                type: "enabled",
                budgetTokens: 10000,
              },
            },
          };
          console.log("🧠 Anthropic thinking mode ACTIVATED with 10k token budget");
        } 
        else if (provider === "openai") {
          // OpenAI: Use reasoningEffort for o1/o3/o4 models
          streamOptions.providerOptions = {
            openai: {
              reasoningEffort: "medium", // 'low', 'medium', or 'high'
              reasoningSummary: "auto",  // 'auto' or 'detailed'
            },
          };
          console.log("🧠 OpenAI reasoning mode ACTIVATED (medium effort)");
        }
        else if (provider === "google") {
          // Google: thinking config if supported
          streamOptions.providerOptions = {
            google: {
              thinkingConfig: {
                thinkingBudget: 10000,
              },
            },
          };
          console.log("🧠 Google thinking mode ACTIVATED with 10k token budget");
        }
      }

      const response = streamText(streamOptions);
      let fullResponseText = "";

      // Use fullStream to capture reasoning/thinking
      for await (const part of response.fullStream) {
        if (this.abortController?.signal.aborted) break;
        
        // Log all event types for debugging
        if (part.type.includes("reasoning")) {
          console.log("🧠 Reasoning event:", part.type, part);
        }
        
        switch (part.type) {
          case "reasoning-start":
            console.log("🧠 REASONING START");
            this.emitChunk({ type: "reasoning-start" });
            break;
          case "reasoning-delta":
            if (part.text) {
              console.log("🧠 REASONING:", part.text.substring(0, 50) + "...");
              this.emitChunk({ type: "reasoning", content: part.text });
            }
            break;
          case "reasoning-end":
            console.log("🧠 REASONING END");
            this.emitChunk({ type: "reasoning-end" });
            break;
          case "text-delta":
            if (part.text) {
              fullResponseText += part.text;
              this.emitChunk({ type: "text", content: part.text });
            }
            break;
          case "error":
            console.error("Stream error:", part);
            break;
          default:
            // tool-call and tool-result are handled by the SDK automatically
            break;
        }
      }

      this.emitChunk({ type: "done", done: true });
      
      // Save conversation at the end
      const fullConversation: Conversation = {
        id: currentConversationId!,
        title: "New Conversation", // Placeholder, will update below if needed
        timestamp: new Date().toISOString(),
        messages: [...aiMessages.filter(m => m.role !== "system"), { role: "assistant", content: fullResponseText }] as ChatMessage[]
      };

      // Retrieve existing if possible to keep title
      try {
        const existingList = await this.getConversations(projectPath);
        const existing = existingList.find(c => c.id === currentConversationId);
        if (existing) {
          fullConversation.title = existing.title;
          // Merge messages properly (the input 'messages' might be user's view, we should trust it but ensure we append the new assistant one)
          // Actually, 'messages' passed in IS the full history minus the new response.
        } else {
          // Generate title for new conversation
          if (messages.length > 0) {
            fullConversation.title = await this.generateTitle(messages);
          }
        }
      } catch (e) { console.error(e); }

      await this.saveConversation(projectPath, fullConversation);

      return { success: true, conversationId: currentConversationId };
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("🛑 Chat aborted");
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

export function getChatAgentService(): ChatAgentService {
  if (!chatAgentInstance) {
    chatAgentInstance = new ChatAgentService();
  }
  return chatAgentInstance;
}
