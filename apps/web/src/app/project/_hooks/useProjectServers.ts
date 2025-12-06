import { useState, useRef, useCallback, useEffect } from "react";
import { ServerInstance, DevToolsLog } from "../_types";

interface UseProjectServersProps {
  projectId: string | null;
  commandsParam: string | null;
  autoStartParam: string | null;
  api: any;
}

export function useProjectServers({
  projectId,
  commandsParam,
  autoStartParam,
  api,
}: UseProjectServersProps) {
  const [commands, setCommands] = useState<string[]>(
    commandsParam ? commandsParam.split(",") : []
  );

  const [servers, setServers] = useState<ServerInstance[]>(
    commands.map((cmd) => ({
      id: "",
      command: cmd,
      status: "idle",
      logs: [],
    }))
  );

  const [devToolsLogs, setDevToolsLogs] = useState<DevToolsLog[]>([]);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [autoStartPending, setAutoStartPending] = useState(
    autoStartParam === "true"
  );

  const serverIdMapRef = useRef<Map<string, number>>(new Map());

  // Sync servers state when commands change
  useEffect(() => {
    setServers(commands.map((cmd) => ({
      id: "",
      command: cmd,
      status: "idle" as const,
      logs: [],
    })));
    serverIdMapRef.current.clear();
  }, [commands]);


  // Function to start all servers
  const startAllServers = useCallback(async () => {
    if (!api || !projectId) return;

    console.log(`[startAllServers] Starting ${commands.length} servers:`, commands);

    const startPromises = commands.map(async (command, i) => {
      console.log(`[startAllServers] Starting server ${i}: ${command}`);
      const port = 48100 + i;

      try {
        setServers((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? { ...s, status: "starting", logs: [`Starting: ${command}...`] }
              : s
          )
        );

        const result = await api.startServer(projectId, command, port, i);

        const serverIndex = result.clientIndex !== undefined ? result.clientIndex : i;
        serverIdMapRef.current.set(result.id, serverIndex);

        console.log(
          `🗺️ Registered server ID mapping: ${result.id} -> index ${serverIndex}`
        );

        setServers((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, id: result.id } : s))
        );

        return { success: true, index: i };
      } catch (err) {
        setServers((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  status: "error",
                  logs: [
                    ...s.logs,
                    `Error: ${err instanceof Error ? err.message : "Failed"}`,
                  ],
                }
              : s
          )
        );
        return { success: false, index: i, error: err };
      }
    });

    await Promise.all(startPromises);
  }, [api, projectId, commands]);

  // Function to restart a single server
  const restartServer = useCallback(
    async (serverIndex: number) => {
      if (!api || !projectId) return;

      const server = servers[serverIndex];
      const command = commands[serverIndex];

      if (!command) return;

      console.log(`🔄 Restarting server ${serverIndex}: ${command}`);

      try {
        if (server.id && server.status === "running") {
          console.log(`⏹️ Stopping server ${server.id}...`);
          await api.stopServer(server.id);
        }

        setServers((prev) =>
          prev.map((s, idx) =>
            idx === serverIndex
              ? {
                  ...s,
                  id: "",
                  status: "starting",
                  logs: [`🔄 Restarting: ${command}...`],
                  url: undefined,
                }
              : s
          )
        );

        await new Promise((resolve) => setTimeout(resolve, 500));

        const port = 48100 + serverIndex;
        const result = await api.startServer(
          projectId,
          command,
          port,
          serverIndex
        );

        serverIdMapRef.current.set(result.id, serverIndex);
        console.log(
          `🗺️ Re-registered server ID mapping: ${result.id} -> index ${serverIndex}`
        );

        setServers((prev) =>
          prev.map((s, idx) =>
            idx === serverIndex ? { ...s, id: result.id } : s
          )
        );

        console.log(`✅ Server ${serverIndex} restarted successfully`);
      } catch (err) {
        console.error(`❌ Failed to restart server ${serverIndex}:`, err);
        setServers((prev) =>
          prev.map((s, idx) =>
            idx === serverIndex
              ? {
                  ...s,
                  status: "error",
                  logs: [
                    ...s.logs,
                    `❌ Restart failed: ${err instanceof Error ? err.message : "Unknown error"}`,
                  ],
                }
              : s
          )
        );
      }
    },
    [api, projectId, commands, servers]
  );

  // Load project info
  useEffect(() => {
    if (!projectId || typeof window === "undefined") return;

    const stored = localStorage.getItem("recentProjects");
    if (stored) {
      const projects = JSON.parse(stored);
      const project = projects.find((p: any) => p.path === projectId);
      if (project) {
        setProjectInfo(project);
      }
    }
  }, [projectId]);

  // Load commands from cache
  useEffect(() => {
    const loadCommandsFromCache = async () => {
      if (!projectId || commandsParam || !api?.analyzeProject) return;

      try {
        console.log("[Project] Loading commands from cache for:", projectId);
        const analysis = await api.analyzeProject(projectId);

        if (analysis.commands && analysis.commands.length > 0) {
          console.log("[Project] Found cached commands:", analysis.commands);
          setCommands(analysis.commands);

          const initializedServers = analysis.commands.map((cmd: string) => ({
            id: "",
            command: cmd,
            status: "idle" as const,
            logs: [],
          }));
          console.log("[Project] Initializing servers:", initializedServers);
          setServers(initializedServers);

          console.log("[Project] Marking servers for auto-start");
          setAutoStartPending(true);
        }
      } catch (error) {
        console.error("[Project] Failed to load commands from cache:", error);
      }
    };

    loadCommandsFromCache();
  }, [projectId, commandsParam, api]);

  // Auto-start servers
  useEffect(() => {
    if (autoStartPending && commands.length > 0 && api) {
      console.log("[Project] Auto-starting servers:", commands);
      setAutoStartPending(false);

      setTimeout(() => {
        startAllServers();
      }, 100);
    }
  }, [autoStartPending, commands, api, startAllServers]);

  // Event Listeners
  useEffect(() => {
    if (!api) return;

    console.log("🎧 Setting up server event listeners");

    if (api.onServerReady) {
      api.onServerReady((server: any) => {
        console.log("📡 Received server:ready event", server);

        let serverIndex = server.clientIndex;
        if (serverIndex === undefined) {
          serverIndex = serverIdMapRef.current.get(server.id);
        }

        setServers((prev) =>
          prev.map((s, idx) => {
            if (
              s.id === server.id ||
              (serverIndex !== undefined && idx === serverIndex)
            ) {
              return {
                ...s,
                id: server.id,
                status: "running",
                url: `http://localhost:${server.port}`,
              };
            }
            return s;
          })
        );
      });
    }

    if (api.onServerStopped) {
      api.onServerStopped((stoppedId: string) => {
        console.log("📡 Received server:stopped event", stoppedId);
        setServers((prev) =>
          prev.map((s) =>
            s.id === stoppedId
              ? { ...s, status: "idle", logs: [...s.logs, "Server stopped"] }
              : s
          )
        );
      });
    }

    if (api.onServerLog) {
      api.onServerLog(
        (logData: {
          id: string;
          log: string;
          type: string;
          clientIndex?: number;
        }) => {
          let serverIndex = logData.clientIndex;
          if (serverIndex === undefined) {
            serverIndex = serverIdMapRef.current.get(logData.id);
          }

          setServers((prev) => {
            return prev.map((s, idx) => {
              if (
                s.id === logData.id ||
                (serverIndex !== undefined && idx === serverIndex)
              ) {
                return { ...s, logs: [...s.logs, logData.log] };
              }
              return s;
            });
          });
        }
      );
    }

    if (api.onBrowserConsoleLog) {
      api.onBrowserConsoleLog((logData: DevToolsLog) => {
        console.log("🌐 Received browser console log:", logData);
        setDevToolsLogs((prev) => [...prev, logData]);
      });
    }
  }, [api]);

  return {
    servers,
    setServers,
    commands,
    setCommands,
    devToolsLogs,
    projectInfo,
    startAllServers,
    restartServer,
  };
}
