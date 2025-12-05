import { streamText, tool, LanguageModel } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { glob } from "glob";
import { spawn } from "child_process";


// Use the exact same tools as the original ChatAgent, but exposed for the Executor loop
// We need to redefine them here or export them from chatAgent (refactoring chatAgent later is better)

// Helper for command execution
// Helper for command execution
const executeCommand = (command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  return new Promise((resolve) => {
    // robust execution using bash -c to handle quotes and pipes
    const proc = spawn("bash", ["-c", command], { cwd });
    
    let stdout = "";
    let stderr = "";
    
    proc.stdout.on("data", (data) => stdout += data.toString());
    proc.stderr.on("data", (data) => stderr += data.toString());
    
    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
    
    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
};

export async function runExecutorStep(
    stepDescription: string,
    history: any[],
    projectPath: string,
    onChunk: (chunk: any) => void,
    model: LanguageModel
) {
  // Define tools locally for now (duplicate of chatAgent, wil refactor later to shared source)
  const tools = {
    readFile: tool({
        description: "Read file content",
        inputSchema: z.object({ filePath: z.string() }),
        // @ts-ignore
        execute: async ({ filePath }: { filePath: string }) => {
            if (!filePath || typeof filePath !== 'string') throw new Error("Invalid filePath");
            const fullPath = path.join(projectPath, filePath);
            const content = await fs.readFile(fullPath, "utf-8");
            return { content: content.slice(0, 10000) };
        }
    }),
    writeFile: tool({
        description: "Write file content",
        inputSchema: z.object({ filePath: z.string(), content: z.string(), explanation: z.string() }),
        // @ts-ignore
        execute: async ({ filePath, content }: { filePath: string; content: string }) => {
            if (!filePath || typeof filePath !== 'string') throw new Error("Invalid filePath");
            const fullPath = path.join(projectPath, filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content);
            return { success: true };
        }
    }),
    listFiles: tool({
        description: "List directory files",
        inputSchema: z.object({ directory: z.string() }),
        // @ts-ignore
        execute: async ({ directory }: { directory: string }) => {
            const dir = directory || ".";
            const fullPath = path.join(projectPath, dir);
            const entries = await fs.readdir(fullPath);
            return { files: entries };
        }
    }),
    runCommand: tool({
        description: "Run terminal command",
        inputSchema: z.object({ command: z.string() }),
        // @ts-ignore
        execute: async ({ command }: { command: string }) => {
            return await executeCommand(command, projectPath);
        }
    })
  };

  const systemPrompt = `You are the EXECUTOR. Your goal is to complete ONE step of a larger plan.
CURRENT STEP: "${stepDescription}"

Use the available tools to achieve this step. 
- If you need to read a file, do it.
- If you need to write code, use writeFile (provide FULL CONTENT).
- If you need to run a command, use runCommand.

Be efficient. Once the step is done, you don't need to say much, just confirm completion.`;

  // Use standard maxSteps behavior as requested
  // @ts-ignore - maxSteps is supported in SDK v5 but types might be lagging or conflicting
  return await streamText({
    model: model,
    system: systemPrompt,
    messages: history,
    tools: tools,
    maxSteps: 5,
    onChunk: (chunk: any) => {
        // Forward chunks (text/tool) to the main Orchestrator callback
        if (chunk.type === 'text-delta') {
            onChunk({ type: "text", content: chunk.textDelta });
        } else if (chunk.type === 'tool-call') {
            console.log("🔧 Executor ToolChunk:", JSON.stringify(chunk, null, 2));
            onChunk({ 
                type: "tool-call", 
                toolCall: { id: chunk.toolCallId, name: chunk.toolName, args: chunk.args, status: "running" } 
            });
        } else if (chunk.type === 'tool-result') {
            // Forward result so UI can update the executing tool to "completed"
             onChunk({ 
                type: "tool-result", 
                toolCall: { id: chunk.toolCallId, name: chunk.toolName, result: chunk.result, status: "completed" } 
            });
        }
    }
  } as any);
}
