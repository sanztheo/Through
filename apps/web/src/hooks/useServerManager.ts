import { useState, useEffect } from "react";
import { useElectronAPI } from "./useElectronAPI";
import type { ServerInstance } from "@through/shared";

export function useServerManager() {
  const { api } = useElectronAPI();
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;

    api.onServerReady((server) => {
      setServers((prev) => [...prev, server]);
    });

    api.onServerStopped((serverId) => {
      setServers((prev) => prev.filter((s) => s.id !== serverId));
    });
  }, [api]);

  const startServer = async (
    projectPath: string,
    command: string,
    port: number,
  ) => {
    if (!api) {
      setError("Electron API not available");
      return null;
    }

    setIsStarting(true);
    setError(null);

    try {
      const server = await api.startServer(projectPath, command, port);
      return server;
    } catch (err: any) {
      setError(err.message || "Failed to start server");
      return null;
    } finally {
      setIsStarting(false);
    }
  };

  const stopServer = async (serverId: string) => {
    if (!api) return;

    try {
      await api.stopServer(serverId);
    } catch (err: any) {
      setError(err.message || "Failed to stop server");
    }
  };

  return {
    servers,
    isStarting,
    error,
    startServer,
    stopServer,
  };
}
