import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
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
  type: "text" | "tool-call" | "tool-result" | "done" | "error";
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

/**
 * Stream a chat response with tools - based on codeAgent.ts pattern
 */
export async function streamChatAgent(params: {
  projectPath: string;
  messages: ChatMessage[];
  onChunk: (chunk: StreamChunk) => void;
}): Promise<void> {
  const { projectPath, messages, onChunk } = params;

  console.log("🤖 Starting chat agent...");
  console.log("📂 Project:", projectPath);

  try {
    // Define tools using the correct SDK syntax (same as codeAgent.ts)
    const searchInProjectTool = tool({
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
                let preview = "";

                lines.forEach((line, index) => {
                  if (line.includes(query)) {
                    matchingLines.push(index + 1);
                    if (!preview) {
                      preview = line.trim().substring(0, 100);
                    }
                  }
                });

                if (matchingLines.length > 0) {
                  results.push({ file, lines: matchingLines, preview });
                }
              }
            } catch (e) {
              // Skip files that can't be read
            }
          }

          console.log(`📁 Found ${results.length} matching files`);
          return results;
        } catch (error: any) {
          return { error: error.message };
        }
      },
    });

    const readFileTool = tool({
      description: "Read the content of a file from the project",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file from project root"),
      }),
      execute: async ({ filePath }) => {
        console.log(`📖 Reading: ${filePath}`);
        try {
          const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
          const content = await fs.readFile(fullPath, "utf-8");
          return { content, path: filePath };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    });

    const replaceInFileTool = tool({
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

          // Normalize line endings for better matching
          const normalizedContent = content.replace(/\r\n/g, "\n");
          const normalizedSearch = search.replace(/\r\n/g, "\n");

          if (!normalizedContent.includes(normalizedSearch)) {
            console.error("❌ Search block not found in file");
            return { 
              success: false, 
              error: "Original code block not found in file. Please ensure 'search' matches EXACTLY the existing code, including indentation. Use readFile to verify." 
            };
          }

          // Perform replacement
          const newContent = normalizedContent.replace(normalizedSearch, replace);
          await fs.writeFile(fullPath, newContent, "utf-8");

          console.log(`✅ File patched: ${filePath}`);
          
          // Notify frontend about the tool result
          onChunk({
            type: "tool-result",
            toolCall: {
              id: `replace-${Date.now()}`,
              name: "replaceInFile",
              args: { filePath, explanation },
              result: { success: true, filePath, explanation },
              status: "completed"
            }
          });
          
          return { success: true, filePath, explanation };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    });

    const listFilesTool = tool({
      description: "List files in a directory to understand project structure",
      inputSchema: z.object({
        directory: z.string().optional().describe("Relative path to directory. Defaults to project root."),
      }),
      execute: async ({ directory }) => {
        const dir = directory || ".";
        console.log(`📂 Listing: ${dir}`);
        
        try {
          const fullPath = path.join(projectPath, dir);
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          
          return entries
            .filter(e => !e.name.startsWith(".") && e.name !== "node_modules")
            .map(e => ({
              name: e.name,
              type: e.isDirectory() ? "directory" : "file",
            }));
        } catch (error: any) {
          return { error: error.message };
        }
      },
    });

    // Get the selected model from settings
    const settings = getSettings();
    const modelConfig = AI_MODELS.find(m => m.id === settings.aiModel) || AI_MODELS.find(m => m.id === "gpt-4o-mini")!;
    
    console.log(`🧠 Using model: ${modelConfig.name} (${modelConfig.provider})`);
    
    // Get the model instance based on provider
    const getModel = () => {
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

    // Get the last user message as the prompt
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    const userPrompt = lastUserMessage?.content || "";

    // Notify that we're starting
    onChunk({ type: "text", content: "" });

    const result = await generateText({
      model: getModel(),
      stopWhen: stepCountIs(10),
      system: `You are Through, a powerful agentic AI coding assistant, inspired by Windsurf and Cursor.
You operate directly on the user's local filesystem in real-time.

<identity>
You are pair programming with a USER to solve their coding task.
The task may require creating a new codebase, modifying or debugging an existing codebase, or simply answering a question.
You have access to tools to search, read, list, and modify files.
</identity>

<tool_usage_rules>
1. **Explore First**: Do not guess file paths. If you don't know the file structure, use listFiles or searchInProject IMMEDIATELY.
2. **Read Before Write**: Before using replaceInFile, YOU MUST read the file using readFile to ensure you have the EXACT existing content for the search block.
3. **Surgical Edits**: Use replaceInFile for all code changes. Do not rewrite entire files unless necessary. The search block must be unique and match exact whitespace.
4. **No Chat Code**: NEVER output code blocks in your text response if you intend to apply them. Use the tool directly. Only show snippets if explaining something.
5. **Tool Naming**: Do not tell the user "I am using searchInProject". Just say "I'm searching for the component...".
6. **Recovery**: If a tool fails (e.g., search block not found), ANALYZE the error, read the file again to get the fresh content, and RETRY immediately with corrected arguments.
</tool_usage_rules>

<workflow_guidance>
- **For Styling**: If asked to change design, find the relevant CSS/Tailwind file first.
- **For Logic**: specific logic changes should be verified by reading the import chain if needed.
- **Errors**: If you see a compilation error or runtime error, use searchInProject to find the symbol/log causing it.
</workflow_guidance>

<style>
- Be concise.
- Act like an expert senior engineer.
- Do not apologize excessively; just fix it.
</style>`,
      prompt: userPrompt,
      tools: {
        searchInProject: searchInProjectTool,
        readFile: readFileTool,
        replaceInFile: replaceInFileTool,
        listFiles: listFilesTool,
      },
      onStepFinish: (step) => {
        // Send tool calls to frontend
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const tc of step.toolCalls) {
            const toolCall = tc as any;
            onChunk({
              type: "tool-call",
              toolCall: {
                id: toolCall.toolCallId,
                name: toolCall.toolName,
                args: toolCall.args || {},
                status: "running"
              }
            });
          }
        }
        
        // Send tool results to frontend
        if (step.toolResults && step.toolResults.length > 0) {
          for (const tr of step.toolResults) {
            const toolResult = tr as any;
            onChunk({
              type: "tool-result",
              toolCall: {
                id: toolResult.toolCallId,
                name: toolResult.toolName,
                args: toolResult.args || {},
                result: toolResult.result,
                status: "completed"
              }
            });
          }
        }
      }
    });

    // Send the final text response
    if (result.text) {
      onChunk({ type: "text", content: result.text });
    }

    onChunk({ type: "done" });

  } catch (error: any) {
    console.error("❌ Chat Agent Error:", error);
    onChunk({ type: "error", error: error.message || "An unexpected error occurred" });
    onChunk({ type: "done" });
  }
}
