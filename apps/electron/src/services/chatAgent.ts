import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { spawn } from "child_process";
import * as crypto from "crypto";
import { getSettings, AI_MODELS, getModel } from "./settings.js";


export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "error";
}

export interface StreamChunk {
  type: "text" | "tool-call" | "tool-result" | "done" | "error";
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}



/**
 * Execute a terminal command
 */
async function executeCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", command], { cwd });
    
    let stdout = "";
    let stderr = "";
    
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    
    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
    
    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
    
    setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr: "Command timed out after 30 seconds", exitCode: 124 });
    }, 30000);
  });
}

/**
 * Stream a chat response with tools
 */
export async function streamChatAgent(params: {
  projectPath: string;
  messages: ChatMessage[];
  onChunk: (chunk: StreamChunk) => void;
}): Promise<void> {
  console.log("✅ streamChatAgent called in chatAgent.ts - ENTRY POINT CONFIRMED");
  const { projectPath, messages, onChunk } = params;

  console.log("💬 Starting chat agent stream...");
  console.log("📂 Project:", projectPath);

  // Define tools using inputSchema
  const tools = {
     searchInProject: tool({
      description: "Search for text, CSS selectors, class names, or content in project files. Returns matching files with line numbers.",
      inputSchema: z.object({
        query: z.string().describe("The text, class name, or selector to search for"),
        fileExtensions: z.array(z.string()).optional().describe("File extensions to search, e.g. ['tsx', 'css']. Defaults to common web files."),
      }),
      execute: async ({ query, fileExtensions }) => {
        console.log(`🔍 Searching for: "${query}"`);
        const extensions = fileExtensions || ["tsx", "jsx", "ts", "js", "vue", "svelte", "css", "scss", "html"];
        const pattern = `**/*.{${extensions.join(",")}}`;
        try {
          const files = await glob(pattern, { 
             cwd: projectPath,
             ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**"],
          });
          const results: Array<{ file: string; lines: number[]; preview: string }> = [];
          for (const file of files.slice(0, 50)) {
            const filePath = path.join(projectPath, file);
            try {
               const content = await fs.readFile(filePath, "utf-8");
               if (content.includes(query)) {
                 const lines = content.split("\n");
                 const matchingLines: number[] = [];
                 lines.forEach((line, index) => { if (line.includes(query)) matchingLines.push(index + 1); });
                 results.push({ file, lines: matchingLines.slice(0, 5), preview: content.slice(0, 200) + "..." });
               }
            } catch {}
          }
          return { results: results.slice(0, 10), count: results.length };
        } catch (error: any) { return { error: error.message }; }
      }
    }),
    readFile: tool({
        description: "Read file content",
        inputSchema: z.object({ filePath: z.string() }),
        execute: async ({ filePath }) => {
            if (!filePath || typeof filePath !== 'string') throw new Error("Invalid filePath");
            const fullPath = path.join(projectPath, filePath);
            const content = await fs.readFile(fullPath, "utf-8");
            return { content: content.slice(0, 10000) };
        }
    }),
    replaceInFile: tool({
      description: "Replace a specific block of code in a file. SAFER than rewriting the whole file.",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file"),
        search: z.string().describe("The EXACT existing code block to replace (must match character-for-character, including whitespace/indentation)"),
        replace: z.string().describe("The new code block to insert"),
        explanation: z.string().describe("Why this change is being made"),
      }),
      execute: async ({ filePath, search, replace, explanation }) => {
        console.log(`✏️ Patching: ${filePath}`);
        try {
          const fullPath = path.join(projectPath, filePath);
          const content = await fs.readFile(fullPath, "utf-8");
          const normalizedContent = content.replace(/\r\n/g, "\n");
          const normalizedSearch = search.replace(/\r\n/g, "\n");
          if (!normalizedContent.includes(normalizedSearch)) {
            console.error("❌ Search block not found in file");
            return { success: false, error: "Original code block not found in file. Ensure 'search' matches EXACTLY." };
          }
          const newContent = normalizedContent.replace(normalizedSearch, replace);
          await fs.writeFile(fullPath, newContent, "utf-8");
          return { success: true };
        } catch (error: any) { return { error: error.message }; }
      },
    }),
    listFiles: tool({
        description: "List directory files",
        inputSchema: z.object({ directory: z.string() }),
        execute: async ({ directory }) => {
            const dir = directory || ".";
            const fullPath = path.join(projectPath, dir);
            const entries = await fs.readdir(fullPath);
            return { files: entries };
        }
    }),
    runCommand: tool({
        description: "Run terminal command",
        inputSchema: z.object({ command: z.string() }),
        execute: async ({ command }) => {
            return await executeCommand(command, projectPath);
        }
    })
  };

  try {
    if (!projectPath) throw new Error("Project path is required for chat agent.");

    // Model Resolution
    const settings = getSettings();
    const modelConfig = AI_MODELS.find(m => m.id === settings.aiModel) || AI_MODELS.find(m => m.id === "gpt-4o-mini")!;
    console.log(`🧠 Using model: ${modelConfig.name} (${modelConfig.provider})`);
    
    const getLocalModel = () => {
      switch (modelConfig.provider) {
        case "anthropic": return anthropic(modelConfig.modelId);
        case "google": return google(modelConfig.modelId);
        case "openai": default: return openai(modelConfig.modelId);
      }
    };
    const model = getLocalModel();

    console.log("🚀 Starting direct Vercel AI SDK stream...");


const SYSTEM_PROMPT = `
You are Through, a powerful agentic AI coding assistant. You operate directly on the user's local filesystem.

<identity>
You are pair programming with a USER to solve their coding task.
The task may require creating a new codebase, modifying or debugging an existing codebase, or simply answering a question.
You have access to tools to search, read, list, and modify files.
</identity>

<tool_usage>
1. **Explore first**: If you don't know the file structure or where code is located, use \`listFiles\` or \`searchInProject\` BEFORE trying to read or edit.
2. **Be precise**: When using \`replaceInFile\`, the \`search\` block must match the existing code character-for-character, including whitespace. Use \`readFile\` first to ensure you have the exact content.
3. **No Code in Chat**: NEVER output code blocks in your text response if you are intended to apply them to a file. Instead, use \`replaceInFile\` directly. Only show code snippets if explicitly asked for an example or explanation.
4. **Tool Names**: NEVER refer to tool names (like "using replaceInFile") when speaking to the USER. Just say "I will update the main component".
5. **Arguments**: ALWAYS provide all necessary parameters. Never properly call a tool with empty arguments unless allowed.
</tool_usage>

<style>
- Be concise and efficient.
- Do not match the user's conversational filler; focus on the task.
- If you make a mistake (like a failed search block), debug it yourself (e.g. read the file again) and retry.
</style>
`;

    const result = streamText({
        model: model,
        messages: messages,
        system: SYSTEM_PROMPT,
        tools: tools,
        maxSteps: 10,
    } as any);

    for await (const part of result.fullStream) {
        const chunk = part as any;
        if (chunk.type === 'text-delta') {
            onChunk({ type: "text", content: chunk.textDelta });
        } else if (chunk.type === 'tool-call') {
            console.log("🔧 Tool Call:", chunk.toolName);
            onChunk({ 
                type: "tool-call", 
                toolCall: { id: chunk.toolCallId, name: chunk.toolName, args: chunk.args, status: "running" } 
            });
        } else if (chunk.type === 'tool-result') {
                onChunk({ 
                type: "tool-result", 
                toolCall: { id: chunk.toolCallId, name: chunk.toolName, args: chunk.args || {}, result: chunk.result, status: "completed" } 
            });
        } else if (chunk.type === 'error') {
            console.error("❌ Stream Error:", chunk.error);
            onChunk({ type: "error", error: JSON.stringify(chunk.error) });
        }
    }

  } catch (error: any) {
    console.error("❌ Chat Agent Error:", error);
    onChunk({ type: "error", error: error.message || "An unexpected error occurred" });
  } finally {
    console.log("✅ Stream completed");
    onChunk({ type: "done" });
  }
}

