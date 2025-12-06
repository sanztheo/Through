import { tool } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { z } from "zod";
import { ToolContext } from "./types.js";

export function createSearchTools({ projectPath, emitToolCall, emitToolResult }: ToolContext) {
  return {
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
  };
}
