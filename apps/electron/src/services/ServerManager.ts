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

    console.log(`Starting server: ${command} (will detect port automatically)`);

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

    // Don't force any port - let the project use its native configuration

    try {
      // Spawn using Rust NAPI with live log streaming (pass 0 to skip PORT env var)
      const handle = spawnDevServerWithLogs(
        workingDir, // Use the parsed working directory
        cmd,
        args,
        0, // Pass 0 to indicate we don't want to set PORT env var
        (log: string, isError: boolean) => {
          // Emit log events to IPC with client index
          if (log.trim()) {
            // Try to detect port from common log patterns
            const detectedPort = this.detectPortFromLog(log);
            if (detectedPort) {
              console.log(
                `🔍 Detected port ${detectedPort} from logs for server ${id}`,
              );
              const server = this.servers.get(id);
              if (server && (!server.port || server.port === 0)) {
                console.log(`✅ Setting port ${detectedPort} for server ${id}`);
                server.port = detectedPort;
                this.servers.set(id, server);
              }
            }

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
        port: 0, // Will be detected from logs
        status: "starting",
        startedAt: new Date(),
      };

      this.servers.set(id, instance);
      console.log(`Server started with PID ${handle.pid}`);

      // Wait for server to be ready by detecting port from logs
      const detectedPort = await this.waitForPortDetection(id);

      instance.port = detectedPort;
      instance.status = "running";
      this.servers.set(id, instance);
      this.emit("server:ready", instance);
      console.log(`Server ready on port ${detectedPort}`);

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

  private async waitForPortDetection(
    serverId: string,
    timeout = 30000,
  ): Promise<number> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const server = this.servers.get(serverId);
      if (server && server.port && server.port > 0) {
        // Port detected from logs
        return server.port;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error("Failed to detect server port within timeout");
  }

  private detectPortFromLog(log: string): number | null {
    // Strip ANSI color codes first for cleaner matching
    const cleanLog = log.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

    // Common patterns for port detection in server logs
    const patterns = [
      /(?:Local|local):\s*https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/i, // Vite, Next.js: Local: http://localhost:5173
      /(?:listening|running|started).*?(?:port|:)\s*(\d+)/i, // Express: listening on port 3001
      /server.*?(?:port|:)\s*(\d+)/i, // Generic: server on port 3000
      /:(\d+)\//i, // URL pattern: http://localhost:3000/
      /Port:\s*(\d+)/i, // Port: 3001
    ];

    for (const pattern of patterns) {
      const match = cleanLog.match(pattern);
      if (match && match[1]) {
        const port = parseInt(match[1], 10);
        if (port > 0 && port < 65536) {
          return port;
        }
      }
    }

    return null;
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
