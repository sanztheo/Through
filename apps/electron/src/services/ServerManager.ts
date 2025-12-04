import {
  spawnDevServerWithLogs,
  killProcess,
  isPortAvailable,
  isPortListening,
  findAvailablePort,
} from "@through/native";
import { EventEmitter } from "events";
import type { ServerInstance } from "@through/shared";
import * as path from "path";

export class ServerManager extends EventEmitter {
  private servers: Map<string, ServerInstance> = new Map();
  private serverIndices: Map<string, number> = new Map(); // Store server ID -> client index mapping

  async startServer(
    projectPath: string,
    command: string,
    port: number,
    clientIndex?: number,
  ): Promise<ServerInstance> {
    const id = this.generateServerId();

    // Store client index if provided
    if (clientIndex !== undefined) {
      this.serverIndices.set(id, clientIndex);
      console.log(`📋 Storing server index mapping: ${id} -> ${clientIndex}`);
    }

    // Check if requested port is already in use, find alternative if needed
    const requestedPort = port;
    const portInUse = isPortListening(requestedPort);

    const actualPort = !portInUse
      ? requestedPort
      : findAvailablePort(requestedPort, requestedPort + 100);

    if (actualPort !== requestedPort) {
      console.log(
        `⚠️ Port ${requestedPort} is already in use, using port ${actualPort} instead`,
      );
    }

    console.log(`Starting server: ${command} on port ${actualPort}`);

    // Parse command: handle "cd folder && npm run dev" format
    let workingDir = projectPath;
    let actualCommand = command;

    // Check if command starts with "cd"
    const cdMatch = command.match(/^cd\s+([^\s&|]+)\s*(?:&&|&)\s*(.+)$/);
    if (cdMatch) {
      const targetDir = cdMatch[1];
      actualCommand = cdMatch[2];
      workingDir = path.join(projectPath, targetDir);
      console.log(`   → Changed directory to: ${workingDir}`);
      console.log(`   → Actual command: ${actualCommand}`);
    }

    // Parse actual command into executable and args
    const [cmd, ...args] = actualCommand.split(" ");

    // Add port argument to the command
    // For npm/yarn: add -- --port <actualPort> or -- -p <actualPort>
    if (cmd === "npm" || cmd === "yarn" || cmd === "pnpm") {
      args.push("--");
      // Detect framework to use correct port flag
      if (actualCommand.includes("vite") || actualCommand.includes("dev")) {
        args.push("--port", actualPort.toString());
      } else {
        args.push("-p", actualPort.toString());
      }
    }

    try {
      // Spawn using Rust NAPI with live log streaming
      const handle = spawnDevServerWithLogs(
        workingDir, // Use the parsed working directory
        cmd,
        args,
        (log: string, isError: boolean) => {
          // Emit log events to IPC with client index
          if (log.trim()) {
            console.log(`[Server ${id}] ${log}`);
            const clientIndex = this.serverIndices.get(id);
            this.emit("server:log", {
              id,
              log: log.trim(),
              type: isError ? "stderr" : "stdout",
              clientIndex, // Include client index for routing
            });
          }
        },
      );

      const instance: ServerInstance = {
        id,
        projectPath,
        command,
        pid: handle.pid,
        port: actualPort,
        status: "starting",
        startedAt: new Date(),
      };

      this.servers.set(id, instance);
      console.log(`Server started with PID ${handle.pid}`);

      // Wait for server to be ready (port becomes occupied)
      await this.waitForServerReady(actualPort);

      instance.status = "running";
      this.emit("server:ready", instance);
      console.log(`Server ready on port ${actualPort}`);

      return instance;
    } catch (error: any) {
      console.error("Failed to start server:", error);
      throw new Error(`Failed to start server: ${error.message}`);
    }
  }

  async stopServer(id: string): Promise<void> {
    const server = this.servers.get(id);

    if (!server) {
      throw new Error(`Server ${id} not found`);
    }

    console.log(`Stopping server ${id} (PID ${server.pid})`);

    killProcess(server.pid);

    server.status = "stopped";
    this.servers.delete(id);
    this.emit("server:stopped", id);
    console.log(`Server ${id} stopped`);
  }

  private async waitForServerReady(
    port: number,
    timeout = 30000,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check if server is actively listening on the port
      const listening = isPortListening(port);
      if (listening) {
        // Server is ready and accepting connections
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error("Server failed to start within timeout");
  }

  private generateServerId(): string {
    return `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getServer(id: string): ServerInstance | undefined {
    return this.servers.get(id);
  }

  getAllServers(): ServerInstance[] {
    return Array.from(this.servers.values());
  }

  async stopAllServers(): Promise<void> {
    console.log("Stopping all servers...");
    const stopPromises = Array.from(this.servers.keys()).map((id) =>
      this.stopServer(id).catch((err) =>
        console.error(`Failed to stop server ${id}:`, err),
      ),
    );
    await Promise.all(stopPromises);
  }
}
