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
  const [chromiumInstance, setChromiumInstance] = useState<any>(null);

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

  // Initialize Chromium browser on mount
  useEffect(() => {
    const initChromium = async () => {
      if (!api?.launchChromium) return;

      try {
        setLogs((prev) => [...prev, "🌐 Initializing Chromium browser..."]);
        const instance = await api.launchChromium({
          width: 1920,
          height: 1080,
          headless: false,
        });
        setChromiumInstance(instance);
        setLogs((prev) => [...prev, `✅ Chromium ready: ${instance.id}`]);
      } catch (error) {
        console.error("Failed to launch Chromium:", error);
        setLogs((prev) => [...prev, `❌ Chromium failed: ${error}`]);
      }
    };

    initChromium();

    // Cleanup on unmount
    return () => {
      if (chromiumInstance?.id && api?.closeChromium) {
        api.closeChromium(chromiumInstance.id).catch(console.error);
      }
    };
  }, [api]);

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

            // Navigate Chromium to the server URL
            if (chromiumInstance?.id && api.navigateChromium) {
              try {
                setLogs((prev) => [
                  ...prev,
                  `🌐 Loading ${url} in Chromium...`,
                ]);
                await api.navigateChromium(chromiumInstance.id, url);
                setLogs((prev) => [...prev, `✅ Preview loaded successfully`]);
              } catch (error) {
                console.error("Failed to navigate Chromium:", error);
                setLogs((prev) => [...prev, `❌ Navigation failed: ${error}`]);
              }
            }
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

        {/* Right: Browser Status */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-white font-medium">Chromium Browser</h2>
            <div className="flex items-center gap-4">
              {serverUrl && (
                <div className="text-gray-400 text-sm">{serverUrl}</div>
              )}
            </div>
          </div>
          <div className="flex-1 bg-gray-900 flex items-center justify-center">
            <div className="text-center max-w-lg px-8">
              {chromiumInstance ? (
                <>
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    🚀 Chromium Browser Active
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Your project is running in a native Chromium window with
                    full browser capabilities.
                  </p>
                  {serverUrl ? (
                    <div className="bg-gray-800 rounded-lg p-4 text-left">
                      <p className="text-sm text-gray-300 mb-2">
                        📍 <span className="font-mono">{serverUrl}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        The preview is displayed in the separate Chromium
                        window. Use your browser&apos;s DevTools for debugging.
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Server is starting... Browser will load automatically.
                    </p>
                  )}
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
                      d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                  </svg>
                  <p className="text-gray-400">
                    Initializing Chromium browser...
                  </p>
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
