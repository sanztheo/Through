import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { Experimental_Agent as Agent, stepCountIs, tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { spawn } from "child_process";
import { getSettings, AI_MODELS } from "./settings.js";

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
  type: "text" | "tool-call" | "tool-result" | "step" | "done" | "error";
  content?: string;
  toolCall?: ToolCall;
  stepNumber?: number;
  error?: string;
}

/**
 * Get the model instance based on settings
 */
function getModelInstance() {
  const settings = getSettings();
  const modelConfig = AI_MODELS.find(m => m.id === settings.aiModel) || AI_MODELS[0];
  
  switch (modelConfig.provider) {
    case "anthropic":
      return anthropic(modelConfig.modelId);
    case "google":
      return google(modelConfig.modelId);
    case "openai":
    default:
      return openai(modelConfig.modelId);
  }
}

/**
 * Execute a shell command
 */
async function executeCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", command], { cwd });
    let stdout = "";
    let stderr = "";
    
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    
    proc.on("close", (code) => {
      resolve({ stdout: stdout.slice(0, 5000), stderr: stderr.slice(0, 2000), exitCode: code ?? 0 });
    });
    
    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
    
    // Timeout after 30s
    setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr: "Command timed out", exitCode: 124 });
    }, 30000);
  });
}

/**
 * Create the coding agent with all tools
 */
function createCodingAgent(
  projectPath: string, 
  onToolCall?: (name: string, args: any) => void, 
  onToolResult?: (name: string, result: any) => void,
  onStep?: (stepNumber: number) => void
) {
  const tools = {
    // 📂 List files in directory
    listFiles: tool({
      description: "List files and folders in a directory. Use this FIRST to explore the project structure.",
      inputSchema: z.object({
        directory: z.string().optional().describe("Path relative to project root. Defaults to root."),
      }),
      execute: async ({ directory }) => {
        const dir = directory || ".";
        console.log(`📂 Listing: ${dir}`);
        onToolCall?.("listFiles", { directory: dir });
        
        try {
          const fullPath = path.join(projectPath, dir);
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          const result = entries
            .filter(e => !e.name.startsWith(".") && !["node_modules", "dist", "build", ".next"].includes(e.name))
            .map(e => ({ name: e.name, type: e.isDirectory() ? "dir" : "file" }));
          
          onToolResult?.("listFiles", result);
          return result;
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    // 🔍 Search in project
    searchInProject: tool({
      description: "Search for text, code, class names, or selectors in project files. Returns files with matching lines.",
      inputSchema: z.object({
        query: z.string().describe("Text/code to search for"),
        fileExtensions: z.array(z.string()).optional().describe("Filter by extensions, e.g. ['css', 'tsx']"),
      }),
      execute: async ({ query, fileExtensions }) => {
        console.log(`🔍 Searching: "${query}"`);
        onToolCall?.("searchInProject", { query });
        
        const extensions = fileExtensions || ["tsx", "jsx", "ts", "js", "css", "scss", "html", "json"];
        const pattern = `**/*.{${extensions.join(",")}}`;
        
        try {
          const files = await glob(pattern, {
            cwd: projectPath,
            ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
          });

          const results: Array<{ file: string; line: number; preview: string }> = [];

          for (const file of files.slice(0, 50)) {
            try {
              const content = await fs.readFile(path.join(projectPath, file), "utf-8");
              const lines = content.split("\n");
              
              lines.forEach((line, idx) => {
                if (line.includes(query)) {
                  results.push({ 
                    file, 
                    line: idx + 1, 
                    preview: line.trim().substring(0, 100) 
                  });
                }
              });
            } catch {}
          }

          console.log(`   Found ${results.length} matches`);
          onToolResult?.("searchInProject", { count: results.length });
          return results.slice(0, 20);
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    // 📖 Read file
    readFile: tool({
      description: "Read the content of a file. ALWAYS use this before editing to get exact content.",
      inputSchema: z.object({
        filePath: z.string().describe("Path to file relative to project root"),
      }),
      execute: async ({ filePath }) => {
        console.log(`📖 Reading: ${filePath}`);
        onToolCall?.("readFile", { filePath });
        
        try {
          const content = await fs.readFile(path.join(projectPath, filePath), "utf-8");
          onToolResult?.("readFile", { path: filePath, lines: content.split("\n").length });
          return { content: content.slice(0, 20000), path: filePath };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    // ✏️ Replace in file
    replaceInFile: tool({
      description: "Replace a block of code in a file. The 'search' must EXACTLY match existing code (copy from readFile).",
      inputSchema: z.object({
        filePath: z.string().describe("Path to file"),
        search: z.string().describe("EXACT existing code to replace (including whitespace)"),
        replace: z.string().describe("New code to insert"),
        explanation: z.string().describe("Brief explanation of the change"),
      }),
      execute: async ({ filePath, search, replace, explanation }) => {
        console.log(`✏️ Editing: ${filePath}`);
        console.log(`   ${explanation}`);
        onToolCall?.("replaceInFile", { filePath, explanation });
        
        try {
          const fullPath = path.join(projectPath, filePath);
          const content = await fs.readFile(fullPath, "utf-8");
          
          const normalizedContent = content.replace(/\r\n/g, "\n");
          const normalizedSearch = search.replace(/\r\n/g, "\n");

          if (!normalizedContent.includes(normalizedSearch)) {
            console.error("❌ Search block not found!");
            return { 
              success: false, 
              error: "Search block not found. Copy the EXACT text from readFile, including all whitespace and indentation." 
            };
          }

          const newContent = normalizedContent.replace(normalizedSearch, replace);
          await fs.writeFile(fullPath, newContent, "utf-8");

          console.log(`✅ Updated: ${filePath}`);
          onToolResult?.("replaceInFile", { success: true, filePath });
          return { success: true, filePath, explanation };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    // 📝 Write new file
    writeFile: tool({
      description: "Create a new file or completely overwrite an existing file.",
      inputSchema: z.object({
        filePath: z.string().describe("Path for the new file"),
        content: z.string().describe("Complete file content"),
        explanation: z.string().describe("Why creating this file"),
      }),
      execute: async ({ filePath, content, explanation }) => {
        console.log(`📝 Creating: ${filePath}`);
        onToolCall?.("writeFile", { filePath, explanation });
        
        try {
          const fullPath = path.join(projectPath, filePath);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content, "utf-8");
          
          console.log(`✅ Created: ${filePath}`);
          onToolResult?.("writeFile", { success: true, filePath });
          return { success: true, filePath, explanation };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    // 🖥️ Run command
    runCommand: tool({
      description: "Execute a shell command in the project directory. Use for npm, git, etc.",
      inputSchema: z.object({
        command: z.string().describe("Command to run (e.g., 'npm install', 'git status')"),
      }),
      execute: async ({ command }) => {
        console.log(`🖥️ Running: ${command}`);
        onToolCall?.("runCommand", { command });
        
        const result = await executeCommand(command, projectPath);
        onToolResult?.("runCommand", { exitCode: result.exitCode });
        return result;
      },
    }),
  };

  return new Agent({
    model: getModelInstance(),
    
    system: `You are Through, an expert AI coding assistant. You modify code directly on the user's filesystem.

<workflow>
1. EXPLORE: Use listFiles to understand project structure
2. SEARCH: Use searchInProject to find relevant files  
3. READ: Use readFile to get exact content before editing
4. EDIT: Use replaceInFile with EXACT matching text
5. VERIFY: Read the file again if needed to confirm changes
</workflow>

<rules>
- NEVER guess file paths - always explore first
- ALWAYS read a file before editing it
- Use replaceInFile for surgical edits, writeFile only for new files
- If replaceInFile fails, read the file again and retry with exact text
- Be concise in explanations
- Execute the full task - don't stop halfway
</rules>

<style>
- Act like an expert senior engineer
- Don't apologize - just fix issues
- Explain what you're doing briefly
</style>`,

    tools,
    
    // Allow up to 20 steps for complex tasks
    stopWhen: stepCountIs(20),
    
    // Dynamic step preparation
    prepareStep: async ({ stepNumber, steps }) => {
      console.log(`\n🔄 Step ${stepNumber + 1}`);
      onStep?.(stepNumber + 1);
      
      // Force exploration on first step if no tool was called yet
      if (stepNumber === 0) {
        return {
          toolChoice: "auto" as const,
        };
      }
      
      // After 10 steps, encourage wrapping up
      if (stepNumber >= 10) {
        return {
          system: `You are Through. You've taken ${stepNumber} steps. Try to complete the task now or explain what's blocking you.`,
        };
      }
      
      return {};
    },
  });
}

/**
 * Stream a chat response using the Agent class
 */
export async function streamChatAgent(params: {
  projectPath: string;
  messages: ChatMessage[];
  onChunk: (chunk: StreamChunk) => void;
}): Promise<void> {
  const { projectPath, messages, onChunk } = params;

  const settings = getSettings();
  const modelConfig = AI_MODELS.find(m => m.id === settings.aiModel) || AI_MODELS[0];
  
  console.log("\n" + "=".repeat(50));
  console.log("🤖 Through Agent Starting");
  console.log(`📂 Project: ${projectPath}`);
  console.log(`🧠 Model: ${modelConfig.name}`);
  console.log(`📜 Messages: ${messages.length}`);
  console.log("=".repeat(50));

  try {
    const agent = createCodingAgent(
      projectPath,
      (name, args) => {
        onChunk({
          type: "tool-call",
          toolCall: { id: `${name}_${Date.now()}`, name, args, status: "running" }
        });
      },
      (name, result) => {
        onChunk({
          type: "tool-result",
          toolCall: { id: `${name}_${Date.now()}`, name, args: {}, result, status: "completed" }
        });
      },
      (stepNumber) => {
        onChunk({ type: "step", stepNumber });
      }
    );

    // Build conversation for context
    const prompt = messages.map(m => 
      `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
    ).join("\n\n");

    // Use streaming for real-time updates
    const stream = agent.stream({ prompt });

    // Stream text chunks
    for await (const chunk of stream.textStream) {
      if (chunk) {
        onChunk({ type: "text", content: chunk });
      }
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ Agent Completed");
    console.log("=".repeat(50) + "\n");

    onChunk({ type: "done" });

  } catch (error: any) {
    console.error("❌ Agent Error:", error);
    onChunk({ type: "error", error: error.message || "Agent failed" });
    onChunk({ type: "done" });
  }
}
