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
  const [browserViewReady, setBrowserViewReady] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const browserViewInitialized = useRef(false);

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
      if (browserViewInitialized.current) return; // Prevent duplicate creation

      try {
        // Get container bounds
        const container = previewContainerRef.current;
        const rect = container.getBoundingClientRect();

        setLogs((prev) => [...prev, "🌐 Creating embedded browser view..."]);

        await api.createBrowserView({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });

        browserViewInitialized.current = true;
        setBrowserViewReady(true);
        setLogs((prev) => [...prev, "✅ Browser view ready"]);
      } catch (error) {
        console.error("Failed to create BrowserView:", error);
        setLogs((prev) => [...prev, `❌ Browser view failed: ${error}`]);
      }
    };

    // Wait a bit for layout to settle
    const timer = setTimeout(initBrowserView, 100);

    // Cleanup on unmount only
    return () => {
      clearTimeout(timer);
      if (browserViewInitialized.current && api?.destroyBrowserView) {
        api.destroyBrowserView().catch(console.error);
        browserViewInitialized.current = false;
      }
    };
  }, [api]);

  // Handle window resize to update BrowserView bounds
  useEffect(() => {
    if (
      !browserViewReady ||
      !api?.setBrowserViewBounds ||
      !previewContainerRef.current
    )
      return;

    const updateBounds = () => {
      const container = previewContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      api
        .setBrowserViewBounds({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        })
        .catch(console.error);
    };

    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, [browserViewReady, api]);

  // Navigate BrowserView when both ready and server URL available
  useEffect(() => {
    console.log("🔍 Navigation useEffect triggered", {
      browserViewReady,
      serverUrl,
      hasNavigateAPI: !!api?.navigateBrowserView,
    });

    const navigateToServer = async () => {
      if (browserViewReady && serverUrl && api?.navigateBrowserView) {
        try {
          console.log("🚀 Attempting navigation to:", serverUrl);
          setLogs((prev) => [...prev, `🌐 Loading ${serverUrl}...`]);
          await api.navigateBrowserView(serverUrl);
          console.log("✅ Navigation succeeded");
          setLogs((prev) => [...prev, `✅ Preview loaded!`]);
        } catch (error) {
          console.error("❌ Navigation failed:", error);
          setLogs((prev) => [...prev, `❌ Navigation failed: ${error}`]);
        }
      } else {
        console.log("⏸️ Navigation skipped - waiting for conditions");
      }
    };

    navigateToServer();
  }, [browserViewReady, serverUrl, api]);

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

        {/* Right: Embedded Preview */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-white font-medium">Live Preview</h2>
            <div className="flex items-center gap-4">
              {serverUrl && (
                <>
                  <div className="text-gray-400 text-sm font-mono">
                    {serverUrl}
                  </div>
                  {browserViewReady && (
                    <button
                      onClick={() => api?.openBrowserViewDevTools()}
                      className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                    >
                      🔍 Inspect
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Preview container - BrowserView will be rendered here */}
          <div
            ref={previewContainerRef}
            className="flex-1 bg-white relative"
            style={{ minHeight: 400 }}
          >
            {!browserViewReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center">
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
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-gray-400">Initializing preview...</p>
                </div>
              </div>
            )}
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
