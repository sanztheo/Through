import { tool } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { z } from "zod";
import { ToolContext } from "./types.js";

export function createFileStructureTools({ projectPath, emitToolCall, emitToolResult }: ToolContext) {
  return {
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
  };
}
