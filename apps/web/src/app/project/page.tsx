"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useElectronAPI } from "@/hooks/useElectronAPI";
import { Terminal } from "lucide-react";

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
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [devToolsLogs, setDevToolsLogs] = useState<
    Array<{ message: string; type: string; source: string; line: number }>
  >([]);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [browserViewReady, setBrowserViewReady] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [activeTab, setActiveTab] = useState<"server" | "devtools">("server");
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  // Initialize BrowserView for embedded preview
  useEffect(() => {
    const initBrowserView = async () => {
      if (!api?.createBrowserView || !previewContainerRef.current) return;

      try {
        const container = previewContainerRef.current;
        const rect = container.getBoundingClientRect();

        console.log("🌐 Initializing BrowserView with bounds:", {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });

        await api.createBrowserView({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });

        setBrowserViewReady(true);
      } catch (error) {
        console.error("Failed to create BrowserView:", error);
      }
    };

    // Small delay to ensure container is rendered
    const timer = setTimeout(initBrowserView, 100);

    return () => {
      clearTimeout(timer);
      if (api?.destroyBrowserView) {
        api.destroyBrowserView().catch(console.error);
      }
    };
  }, [api]);

  // Update BrowserView bounds when terminal sidebar opens/closes
  useEffect(() => {
    const updateBrowserViewBounds = async () => {
      if (
        !api?.setBrowserViewBounds ||
        !previewContainerRef.current ||
        !browserViewReady
      )
        return;

      try {
        const container = previewContainerRef.current;
        const rect = container.getBoundingClientRect();

        // Calculate bounds - shift right if terminal is open (384px is sidebar width)
        const xOffset = showTerminal ? 384 : 0;
        const widthReduction = showTerminal ? 384 : 0;

        await api.setBrowserViewBounds({
          x: Math.round(rect.left + xOffset),
          y: Math.round(rect.top),
          width: Math.round(rect.width - widthReduction),
          height: Math.round(rect.height),
        });

        console.log("📐 Updated BrowserView bounds:", {
          x: Math.round(rect.left + xOffset),
          y: Math.round(rect.top),
          width: Math.round(rect.width - widthReduction),
          height: Math.round(rect.height),
        });
      } catch (error) {
        console.error("Failed to update BrowserView bounds:", error);
      }
    };

    updateBrowserViewBounds();
  }, [showTerminal, browserViewReady, api]);

  // Navigate BrowserView when both ready and server URL is available
  useEffect(() => {
    const navigateToServer = async () => {
      if (!browserViewReady || !serverUrl || !api?.navigateBrowserView) return;

      try {
        console.log(`🔗 Navigating embedded preview to ${serverUrl}`);
        await api.navigateBrowserView(serverUrl);
      } catch (error) {
        console.error("Failed to navigate BrowserView:", error);
      }
    };

    navigateToServer();
  }, [browserViewReady, serverUrl, api?.navigateBrowserView]);

  // Set up server event listeners ONCE when component mounts (to avoid race condition)
  useEffect(() => {
    if (!api) return;

    console.log("🎧 Setting up server event listeners");

    // Listen for server ready event
    if (api.onServerReady) {
      api.onServerReady((server: any) => {
        console.log("📡 Received server:ready event", server);
        setServerStatus("running");
        const url = `http://localhost:${server.port}`;
        setServerUrl(url);
      });
    }

    // Listen for server stopped event
    if (api.onServerStopped) {
      api.onServerStopped((stoppedId: string) => {
        console.log("📡 Received server:stopped event", stoppedId);
        setServerStatus("idle");
        setServerUrl(null);
        setServerLogs((prev) => [...prev, "Server stopped"]);
      });
    }

    // Listen for server logs
    if (api.onServerLog) {
      api.onServerLog((logData: { id: string; log: string; type: string }) => {
        console.log("📋 Received server log:", logData);
        setServerLogs((prev) => [...prev, logData.log]);
      });
    }

    // Listen for browser console logs
    if (api.onBrowserConsoleLog) {
      api.onBrowserConsoleLog((logData) => {
        console.log("🌐 Received browser console log:", logData);
        setDevToolsLogs((prev) => [...prev, logData]);
      });
    }
  }, [api]);

  // Auto-start server when project info is loaded
  useEffect(() => {
    if (projectInfo && api && serverStatus === "idle") {
      startServer();
    }
  }, [projectInfo, api]);

  const startServer = async () => {
    if (!api || !projectInfo) return;

    try {
      setServerStatus("starting");
      setServerLogs([`Starting ${projectInfo.framework} dev server...`]);

      const result = await api.startServer(
        projectInfo.path,
        projectInfo.startCommand,
        projectInfo.port,
      );

      setServerId(result.id);
      // Event listeners are set up in a separate useEffect to avoid race conditions
    } catch (err) {
      setServerStatus("error");
      setServerLogs((prev) => [
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
      setServerLogs((prev) => [...prev, "Server stopped"]);
    } catch (err) {
      setServerLogs((prev) => [
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
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-200 bg-white z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-5 h-5"
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
            <h1 className="text-gray-900 font-semibold text-sm">
              {projectInfo.name}
            </h1>
            <p className="text-gray-500 text-[10px]">
              {projectInfo.framework} · Port {projectInfo.port}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                serverStatus === "running"
                  ? "bg-green-500"
                  : serverStatus === "starting"
                    ? "bg-yellow-500 animate-pulse"
                    : serverStatus === "error"
                      ? "bg-red-500"
                      : "bg-gray-400"
              }`}
            />
            <span className="text-[10px] text-gray-600 font-medium">
              {serverStatus === "running"
                ? "Running"
                : serverStatus === "starting"
                  ? "Starting..."
                  : serverStatus === "error"
                    ? "Error"
                    : "Idle"}
            </span>
          </div>
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`p-1.5 rounded-md transition-colors ${
              showTerminal
                ? "bg-gray-200 text-gray-900"
                : "bg-white hover:bg-gray-100 text-gray-600"
            }`}
            title="Toggle Terminal"
          >
            <Terminal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content - Full Screen Preview */}
      <div className="flex-1 relative overflow-hidden">
        {/* Browser Preview */}
        <div ref={previewContainerRef} className="absolute inset-0 bg-white">
          {!browserViewReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-pulse"
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
                <p className="text-gray-600">Initializing preview...</p>
              </div>
            </div>
          )}
          {browserViewReady && !serverUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-yellow-500 animate-pulse"
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
                <p className="text-gray-600">Waiting for server...</p>
              </div>
            </div>
          )}
        </div>

        {/* Terminal Sidebar */}
        <div
          className={`absolute top-0 left-0 h-full w-96 bg-gray-50 border-r border-gray-200 transition-transform duration-300 ease-in-out z-20 shadow-xl ${
            showTerminal ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
              <h2 className="text-gray-900 font-semibold text-sm">Terminal</h2>
              <button
                onClick={() => setShowTerminal(false)}
                className="text-gray-500 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-100"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
              <button
                onClick={() => setActiveTab("server")}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                  activeTab === "server"
                    ? "text-gray-900 border-b-2 border-gray-900 bg-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Server
              </button>
              <button
                onClick={() => setActiveTab("devtools")}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                  activeTab === "devtools"
                    ? "text-gray-900 border-b-2 border-gray-900 bg-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                DevTools
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-white">
              {activeTab === "server" ? (
                <>
                  {serverLogs.map((log, index) => (
                    <div
                      key={index}
                      className="text-gray-800 mb-1 leading-relaxed"
                    >
                      {log}
                    </div>
                  ))}
                  {serverLogs.length === 0 && (
                    <div className="text-gray-400 text-sm">
                      No server logs yet. Start the server to see output.
                    </div>
                  )}
                </>
              ) : (
                <>
                  {devToolsLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`mb-1 leading-relaxed ${
                        log.type === "error"
                          ? "text-red-600"
                          : log.type === "warning"
                            ? "text-yellow-600"
                            : log.type === "debug"
                              ? "text-blue-600"
                              : "text-gray-800"
                      }`}
                    >
                      <span className="text-gray-500 mr-2">[{log.type}]</span>
                      {log.message}
                    </div>
                  ))}
                  {devToolsLogs.length === 0 && (
                    <div className="text-gray-400 text-sm">
                      No console logs yet. Open your app in the preview to see
                      console output.
                    </div>
                  )}
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
