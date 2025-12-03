"use client";

import { useState, useEffect, Suspense } from "react";
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

  useEffect(() => {
    if (!projectPath) return;

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
        api.onServerReady((server: any) => {
          if (server.id === result.id) {
            setServerStatus("running");
            setServerUrl(`http://localhost:${server.port}`);
            setLogs((prev) => [
              ...prev,
              `✓ Server running at http://localhost:${server.port}`,
            ]);
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
        <div className="flex gap-2">
          {serverStatus === "idle" && (
            <button
              onClick={startServer}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Start Server
            </button>
          )}
          {serverStatus === "starting" && (
            <button
              disabled
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg cursor-not-allowed"
            >
              Starting...
            </button>
          )}
          {serverStatus === "running" && (
            <button
              onClick={stopServer}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Stop Server
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

        {/* Right: Localhost Preview */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-white font-medium">Preview</h2>
            {serverUrl && (
              <div className="text-gray-400 text-sm">{serverUrl}</div>
            )}
          </div>
          <div className="flex-1 bg-white">
            {serverUrl ? (
              <webview
                src={serverUrl}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-400"
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
                  <p>Start the server to see the preview</p>
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
