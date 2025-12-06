import { tool } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { ToolContext } from "./types.js";

export function createFileManagementTools({ projectPath, emitToolCall, emitToolResult, addPendingChange }: ToolContext) {
  if (!addPendingChange) throw new Error("addPendingChange is required for management tools");

  return {
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
  };
}
