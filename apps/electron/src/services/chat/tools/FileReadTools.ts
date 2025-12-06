import { tool } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { ToolContext } from "./types.js";

export function createFileReadTools({ projectPath, emitToolCall, emitToolResult }: ToolContext) {
  return {
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
  };
}
