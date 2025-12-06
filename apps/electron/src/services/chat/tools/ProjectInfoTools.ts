import { tool } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { ToolContext } from "./types.js";

const execAsync = promisify(exec);

export function createProjectInfoTools({ projectPath, emitToolCall, emitToolResult }: ToolContext) {
  return {
    getPackageInfo: tool({
      description: "Read package.json to understand project dependencies and scripts",
      inputSchema: z.object({}),
      execute: async () => {
        const callId = `pkg-${Date.now()}`;
        emitToolCall({ id: callId, name: "getPackageInfo", args: {} });

        try {
          const pkgPath = path.join(projectPath, "package.json");
          const content = await fs.readFile(pkgPath, "utf-8");
          const pkg = JSON.parse(content);

          const result = {
            name: pkg.name,
            version: pkg.version,
            scripts: pkg.scripts || {},
            dependencies: Object.keys(pkg.dependencies || {}),
            devDependencies: Object.keys(pkg.devDependencies || {}),
          };
          emitToolResult({ id: callId, name: "getPackageInfo", result });
          return result;
        } catch (error: any) {
          const result = { error: error.message };
          emitToolResult({ id: callId, name: "getPackageInfo", result });
          return result;
        }
      },
    }),

    runCommand: tool({
      description: "Run a shell command in the project directory. Use for npm commands, git, etc.",
      inputSchema: z.object({
        command: z.string().describe("Command to run (e.g. 'npm install lodash')"),
        timeout: z.number().optional().describe("Timeout in ms (default: 30000)"),
      }),
      execute: async ({ command, timeout = 30000 }) => {
        const callId = `cmd-${Date.now()}`;
        emitToolCall({ id: callId, name: "runCommand", args: { command } });

        // Security: block dangerous commands
        const blocked = ["rm -rf /", "sudo", ":(){ :|:& };:", "mkfs", "dd if="];
        if (blocked.some(b => command.includes(b))) {
          const result = { error: "Command blocked for security reasons" };
          emitToolResult({ id: callId, name: "runCommand", result });
          return result;
        }

        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: projectPath,
            timeout,
          });

          const result = {
            success: true,
            stdout: stdout.substring(0, 2000),
            stderr: stderr.substring(0, 500)
          };
          emitToolResult({ id: callId, name: "runCommand", result: { success: true } });
          return result;
        } catch (error: any) {
          const result = { error: error.message, stderr: error.stderr?.substring(0, 500) };
          emitToolResult({ id: callId, name: "runCommand", result });
          return result;
        }
      },
    }),
  };
}
