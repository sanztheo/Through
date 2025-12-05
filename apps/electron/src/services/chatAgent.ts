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
import { runOrchestrator } from "./agents/orchestrator";

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
  const { projectPath, messages, onChunk } = params;

  console.log("💬 Starting chat agent stream...");
  console.log("📂 Project:", projectPath);

  // Define tools using inputSchema (same as codeAgent.ts)
  const readFileTool = tool({
    description: "Read the contents of a file in the project",
    inputSchema: z.object({
      filePath: z.string().describe("Relative path to the file from project root"),
    }),
    execute: async ({ filePath }) => {
      const toolId = crypto.randomUUID();
      // Defensive check for argument
      if (!filePath || typeof filePath !== 'string') {
         const errorMsg = "Invalid argument: filePath must be a string";
         onChunk({ type: "tool-call", toolCall: { id: toolId, name: "readFile", args: { filePath }, status: "running" } });
         onChunk({ type: "tool-result", toolCall: { id: toolId, name: "readFile", args: { filePath }, result: { success: false, error: errorMsg }, status: "error" } });
         return { success: false, error: errorMsg };
      }

      const fullPath = path.join(projectPath, filePath);
      onChunk({ type: "tool-call", toolCall: { id: toolId, name: "readFile", args: { filePath }, status: "running" } });
      
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const result = { success: true, content: content.slice(0, 10000) };
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "readFile", args: { filePath }, result, status: "completed" } });
        return result;
      } catch (error: any) {
        const result = { success: false, error: error.message };
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "readFile", args: { filePath }, result, status: "error" } });
        return result;
      }
    },
  });

  const writeFileTool = tool({
    description: "Write or modify a file in the project. ONLY modify existing files.",
    inputSchema: z.object({
      filePath: z.string().describe("Relative path to the file"),
      content: z.string().describe("New content for the file"),
      explanation: z.string().describe("Brief explanation of changes"),
    }),
    execute: async ({ filePath, content, explanation }) => {
      const toolId = crypto.randomUUID();
      
      if (!filePath || typeof filePath !== 'string') {
         const errorMsg = "Invalid argument: filePath must be a string";
         onChunk({ type: "tool-call", toolCall: { id: toolId, name: "writeFile", args: { filePath, explanation }, status: "running" } });
         onChunk({ type: "tool-result", toolCall: { id: toolId, name: "writeFile", args: { filePath, explanation }, result: { success: false, error: errorMsg }, status: "error" } });
         return { success: false, error: errorMsg };
      }

      const fullPath = path.join(projectPath, filePath);
      onChunk({ type: "tool-call", toolCall: { id: toolId, name: "writeFile", args: { filePath, explanation }, status: "running" } });
      
      try {
        // Ensure parent directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        // Backup existing file if allowed/possible
        try {
            await fs.access(fullPath);
            const backupPath = fullPath + ".backup." + Date.now();
            const originalContent = await fs.readFile(fullPath, "utf-8");
            await fs.writeFile(backupPath, originalContent);
        } catch {}

        await fs.writeFile(fullPath, content);
        
        const result = { success: true, message: `Modified ${filePath}: ${explanation}` };
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "writeFile", args: { filePath, explanation }, result, status: "completed" } });
        return result;
      } catch (error: any) {
        const result = { success: false, error: error.message };
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "writeFile", args: { filePath, explanation }, result, status: "error" } });
        return result;
      }
    },
  });

  const searchProjectTool = tool({
    description: "Search for text or patterns in project files",
    inputSchema: z.object({
      query: z.string().describe("Text or pattern to search for"),
      fileExtensions: z.array(z.string()).optional().describe("File extensions to include"),
    }),
    execute: async ({ query, fileExtensions }) => {
      const toolId = crypto.randomUUID();
      onChunk({ type: "tool-call", toolCall: { id: toolId, name: "searchProject", args: { query }, status: "running" } });
      
      try {
        const extensions = fileExtensions || ["ts", "tsx", "js", "jsx", "css", "scss", "html", "vue", "svelte"];
        const patterns = extensions.map(ext => `**/*.${ext}`);
        
        const files = await glob(patterns, {
          cwd: projectPath,
          ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
          nodir: true,
        });

        const results: { file: string; line: number; content: string }[] = [];
        
        for (const file of files.slice(0, 50)) {
          try {
            const fileContent = await fs.readFile(path.join(projectPath, file), "utf-8");
            const lines = fileContent.split("\n");
            
            lines.forEach((lineContent, index) => {
              if (lineContent.toLowerCase().includes(query.toLowerCase())) {
                results.push({ file, line: index + 1, content: lineContent.trim().slice(0, 200) });
              }
            });
          } catch {}
        }

        const result = { matches: results.slice(0, 20) };
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "searchProject", args: { query }, result, status: "completed" } });
        return result;
      } catch (error: any) {
        const result = { error: error.message };
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "searchProject", args: { query }, result, status: "error" } });
        return result;
      }
    },
  });

  const listFilesTool = tool({
    description: "List files in a directory",
    inputSchema: z.object({
      directory: z.string().describe("Directory path relative to project root"),
    }),
    execute: async ({ directory }) => {
      const toolId = crypto.randomUUID();
      const targetDir = directory || "."; // Default to root if undefined/empty? Or enforce? Enforce safer.
      
      if (typeof targetDir !== 'string') {
        const errorMsg = "Invalid argument: directory must be a string";
        onChunk({ type: "tool-call", toolCall: { id: toolId, name: "listFiles", args: { directory }, status: "running" } });
         onChunk({ type: "tool-result", toolCall: { id: toolId, name: "listFiles", args: { directory }, result: { error: errorMsg }, status: "error" } });
         return { error: errorMsg };
      }

      onChunk({ type: "tool-call", toolCall: { id: toolId, name: "listFiles", args: { directory }, status: "running" } });
      
      try {
        const fullPath = path.join(projectPath, targetDir);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        
        const result = {
          files: entries
            .filter(e => !e.name.startsWith(".") && e.name !== "node_modules")
            .map(e => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" })),
        };
        
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "listFiles", args: { directory }, result, status: "completed" } });
        return result;
      } catch (error: any) {
        const result = { error: error.message };
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "listFiles", args: { directory }, result, status: "error" } });
        return result;
      }
    },
  });

  const runCommandTool = tool({
    description: "Execute a terminal command. Use for npm commands, git, etc.",
    inputSchema: z.object({
      command: z.string().describe("Command to execute"),
    }),
    execute: async ({ command }) => {
      console.log(`🖥️ Executing command: ${command}`);
      const toolId = crypto.randomUUID();
      onChunk({ type: "tool-call", toolCall: { id: toolId, name: "runCommand", args: { command }, status: "running" } });
      
      const dangerous = ["rm -rf", "sudo", "format", "mkfs", "> /dev"];
      if (dangerous.some(d => command.includes(d))) {
        const result = { success: false, error: "Command blocked for safety" };
        onChunk({ type: "tool-result", toolCall: { id: toolId, name: "runCommand", args: { command }, result, status: "error" } });
        return result;
      }
      
      const { stdout, stderr, exitCode } = await executeCommand(command, projectPath);
      const result = { success: exitCode === 0, stdout: stdout.slice(0, 5000), stderr: stderr.slice(0, 1000), exitCode };
      onChunk({ type: "tool-result", toolCall: { id: toolId, name: "runCommand", args: { command }, result, status: exitCode === 0 ? "completed" : "error" } });
      return result;
    },
  });

  const definedTools = {
    readFile: readFileTool,
    writeFile: writeFileTool,
    searchProject: searchProjectTool,
    listFiles: listFilesTool,
    runCommand: runCommandTool,
  };

  try {
    if (!projectPath) {
      throw new Error("Project path is required for chat agent.");
    }

    // Get the selected model from settings (local resolution logic)
    const settings = getSettings();
    const modelConfig = AI_MODELS.find(m => m.id === settings.aiModel) || AI_MODELS.find(m => m.id === "gpt-4o-mini")!;
    
    console.log(`🧠 Using model: ${modelConfig.name} (${modelConfig.provider})`);
    
    // Get the model instance based on provider
    const getLocalModel = () => {
      switch (modelConfig.provider) {
        case "anthropic":
          return anthropic(modelConfig.modelId);
        case "google":
          return google(modelConfig.modelId);
        case "openai":
        default:
          return openai(modelConfig.modelId);
      }
    };
    
    const model = getLocalModel();

    console.log("🚀 handing off to Multi-Agent Orchestrator");
    await runOrchestrator(messages[messages.length - 1].content, {
        projectPath,
        messages,
        onChunk,
        model
    });

  } catch (error: any) {
    console.error("❌ Chat Agent Error:", error);
    onChunk({ type: "error", error: error.message || "An unexpected error occurred" });
  } finally {
    onChunk({ type: "done" });
  }
}

