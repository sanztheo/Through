import { streamText, tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { glob } from "glob";
import { spawn } from "child_process";
import { getModel } from "../settings";

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
    onChunk: (chunk: any) => void
) {
  // Define tools locally for now (duplicate of chatAgent, wil refactor later to shared source)
  const tools = {
    readFile: tool({
        description: "Read file content",
        parameters: z.object({ filePath: z.string() }),
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
        parameters: z.object({ filePath: z.string(), content: z.string(), explanation: z.string() }),
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
        parameters: z.object({ directory: z.string() }),
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
        parameters: z.object({ command: z.string() }),
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

  // Manual loop for multi-step execution since maxSteps is not supported
  let currentHistory = [...history]; // working copy
  let finalResult = ""; 
  
  let steps = 0;
  while (steps < 5) {
    steps++;
    
    const result = await streamText({
        model: getModel(),
        system: systemPrompt,
        messages: currentHistory,
        tools: tools,
    });

    let fullText = "";
    const toolCalls: any[] = [];

    for await (const chunk of result.fullStream) {
        if (chunk.type === "text-delta") {
            const text = (chunk as any).textDelta || (chunk as any).text || "";
            onChunk({ type: "text", content: text });
            fullText += text;
        } else if (chunk.type === "tool-call") {
            console.log("🔧 Executor ToolChunk:", JSON.stringify(chunk, null, 2));
            toolCalls.push(chunk);
            onChunk({ 
                type: "tool-call", 
                toolCall: { id: (chunk as any).toolCallId, name: (chunk as any).toolName, args: (chunk as any).args, status: "running" } 
            });
        }
    }
    
    finalResult += fullText;
    
    currentHistory.push({
        role: "assistant",
        content: fullText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });

    if (toolCalls.length === 0) {
        // No tools called, we are done
        break;
    }

    // Execute tools and continue loop
    const toolResults = [];
    for (const tc of toolCalls) {
        const toolName = tc.toolName as keyof typeof tools;
        const toolInstance = tools[toolName];
        
        if (toolInstance && toolInstance.execute) {
             const args = tc.args || {};
             const result = await (toolInstance as any).execute(args, { toolCallId: tc.toolCallId, messages: currentHistory });
             
             toolResults.push({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                result: result,
             });

             onChunk({ 
                type: "tool-result", 
                toolCall: { id: tc.toolCallId, name: tc.toolName, result: result, status: "completed" } 
            });
        }
    }
    
    currentHistory.push({
        role: "tool",
        content: toolResults,
    });
  }

  return { 
      text: Promise.resolve(finalResult),
      fullStream: [],
  };
}
