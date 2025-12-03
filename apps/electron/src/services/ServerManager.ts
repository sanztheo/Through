import {
  spawn_dev_server,
  kill_process,
  is_port_available,
} from "@through/native";
import { EventEmitter } from "events";
import type { ServerInstance } from "@through/shared";

export class ServerManager extends EventEmitter {
  private servers: Map<string, ServerInstance> = new Map();

  async startServer(
    projectPath: string,
    command: string,
    port: number,
  ): Promise<ServerInstance> {
    const id = this.generateServerId();

    console.log(`Starting server: ${command} on port ${port}`);

    // Parse command into executable and args
    const [cmd, ...args] = command.split(" ");

    try {
      // Spawn using Rust NAPI
      const handle = spawn_dev_server(projectPath, cmd, args);

      const instance: ServerInstance = {
        id,
        projectPath,
        command,
        pid: handle.pid,
        port,
        status: "starting",
        startedAt: new Date(),
      };

      this.servers.set(id, instance);
      console.log(`Server started with PID ${handle.pid}`);

      // Wait for server to be ready (port becomes occupied)
      await this.waitForServerReady(port);

      instance.status = "running";
      this.emit("server:ready", instance);
      console.log(`Server ready on port ${port}`);

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
    kill_process(server.pid);
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
      const available = is_port_available(port);
      if (!available) {
        // Port is now occupied, server is ready
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
