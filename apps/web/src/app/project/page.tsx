"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useElectronAPI } from "@/hooks/useElectronAPI";

function ProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectPath = searchParams.get("path");
  const { api } = useElectronAPI();

  const [serverStatus, setServerStatus] = useState<
    "idle" | "starting" | "running" | "error"
  >("idle");
  const [serverId, setServerId] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [chromiumId, setChromiumId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath || typeof window === "undefined") return;

    // Load project info from localStorage
    const stored = localStorage.getItem("recentProjects");
    if (stored) {
      const projects = JSON.parse(stored);
      const project = projects.find((p: any) => p.path === projectPath);
      if (project) {
        setProjectInfo(project);
      }
    }
  }, [projectPath]);

  // Launch Chromium and navigate when server is ready
  useEffect(() => {
    const launchAndNavigate = async () => {
      if (!serverUrl || !api?.launchChromium || !api?.navigateChromium) return;
      if (chromiumId) return; // Already launched

      try {
        setLogs((prev) => [...prev, "🚀 Launching Chromium browser..."]);
        const instance = await api.launchChromium({
          width: 1400,
          height: 900,
          headless: false,
        });

        setChromiumId(instance.id);
        setLogs((prev) => [...prev, `✅ Chromium launched: ${instance.id}`]);

        // Navigate to server URL
        setLogs((prev) => [...prev, `🌐 Navigating to ${serverUrl}...`]);
        await api.navigateChromium(instance.id, serverUrl);
        setLogs((prev) => [...prev, `✅ Navigated to ${serverUrl}`]);
      } catch (error) {
        console.error("Failed to launch Chromium:", error);
        setLogs((prev) => [...prev, `❌ Chromium error: ${error}`]);
      }
    };

    launchAndNavigate();
  }, [serverUrl, api, chromiumId]);

  // Auto-start server when project info is loaded
  useEffect(() => {
    if (projectInfo && api && serverStatus === "idle") {
      setLogs((prev) => [
        ...prev,
        `🚀 Auto-starting ${projectInfo.framework} dev server...`,
        `📂 Project: ${projectInfo.name}`,
        `🛠️ Command: ${projectInfo.startCommand}`,
        `🔌 Port: ${projectInfo.port}`,
      ]);
      startServer();
    }
  }, [projectInfo, api]);

  const startServer = async () => {
    if (!api || !projectInfo) return;

    try {
      setServerStatus("starting");
      setLogs([`Starting ${projectInfo.framework} dev server...`]);
      setLogs((prev) => [...prev, `Command: ${projectInfo.startCommand}`]);
      setLogs((prev) => [...prev, `Port: ${projectInfo.port}`]);

      const result = await api.startServer(
        projectInfo.path,
        projectInfo.startCommand,
        projectInfo.port,
      );

      setServerId(result.id);

      // Listen for server ready event
      if (api.onServerReady) {
        api.onServerReady(async (server: any) => {
          if (server.id === result.id) {
            setServerStatus("running");
            const url = `http://localhost:${server.port}`;
            setServerUrl(url);
            setLogs((prev) => [...prev, `✅ Server running at ${url}`]);
            // Navigation will be handled by the useEffect that watches browserViewReady and serverUrl
          }
        });
      }

      // Listen for server stopped event
      if (api.onServerStopped) {
        api.onServerStopped((stoppedId: string) => {
          if (stoppedId === result.id) {
            setServerStatus("idle");
            setServerUrl(null);
            setLogs((prev) => [...prev, "Server stopped"]);
          }
        });
      }
    } catch (err) {
      setServerStatus("error");
      setLogs((prev) => [
        ...prev,
        `Error: ${err instanceof Error ? err.message : "Failed to start server"}`,
      ]);
    }
  };

  const stopServer = async () => {
    if (!api || !serverId) return;

    try {
      await api.stopServer(serverId);
      setServerStatus("idle");
      setServerUrl(null);
      setServerId(null);
      setLogs((prev) => [...prev, "Server stopped"]);
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        `Error stopping server: ${err instanceof Error ? err.message : "Unknown error"}`,
      ]);
    }
  };

  if (!projectPath || !projectInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1e293b]">
        <div className="text-white">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e293b]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-semibold text-lg">
              {projectInfo.name}
            </h1>
            <p className="text-gray-400 text-sm">
              {projectInfo.framework} · Port {projectInfo.port}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                serverStatus === "running"
                  ? "bg-green-500"
                  : serverStatus === "starting"
                    ? "bg-yellow-500 animate-pulse"
                    : serverStatus === "error"
                      ? "bg-red-500"
                      : "bg-gray-500"
              }`}
            />
            <span className="text-sm text-gray-400">
              {serverStatus === "running"
                ? "Running"
                : serverStatus === "starting"
                  ? "Starting..."
                  : serverStatus === "error"
                    ? "Error"
                    : "Idle"}
            </span>
          </div>
          {serverStatus === "running" && (
            <button
              onClick={stopServer}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Terminal Output */}
        <div className="w-1/3 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-white font-medium">Terminal</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-gray-900 font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index} className="text-gray-300 mb-1">
                {log}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-gray-500">
                No logs yet. Start the server to see output.
              </div>
            )}
          </div>
        </div>

        {/* Right: Chromium Browser Status */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-white font-medium">Chromium Browser</h2>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              {chromiumId ? (
                <>
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-white font-medium mb-2">
                    🚀 Chromium Browser Active
                  </p>
                  <p className="text-gray-400 text-sm mb-1">
                    Running at: {serverUrl}
                  </p>
                  <p className="text-gray-500 text-xs">
                    Browser ID: {chromiumId}
                  </p>
                </>
              ) : (
                <>
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-600 animate-pulse"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-gray-400">Waiting for server...</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#1e293b]">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <ProjectContent />
    </Suspense>
  );
}
