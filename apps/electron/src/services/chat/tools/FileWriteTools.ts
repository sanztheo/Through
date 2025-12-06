import { tool } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { ToolContext } from "./types.js";

export function createFileWriteTools({ projectPath, emitToolCall, emitToolResult, addPendingChange }: ToolContext) {
  if (!addPendingChange) throw new Error("addPendingChange is required for write tools");

  return {
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
  };
}
