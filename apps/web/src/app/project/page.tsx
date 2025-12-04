"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useElectronAPI } from "@/hooks/useElectronAPI";
import { Terminal } from "lucide-react";

// Parse ANSI color codes and emojis to styled HTML
function parseLogLine(text: string): React.ReactNode[] {
  const ansiRegex = /\u001b\[(\d+)m/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentColor = "";

  const colorMap: Record<string, string> = {
    "30": "text-black",
    "31": "text-red-600",
    "32": "text-green-600",
    "33": "text-yellow-700",
    "34": "text-blue-600",
    "35": "text-purple-600",
    "36": "text-cyan-600",
    "37": "text-gray-700",
    "90": "text-gray-600",
    "91": "text-red-700",
    "92": "text-green-700",
    "93": "text-yellow-800",
    "94": "text-blue-700",
    "95": "text-purple-700",
    "96": "text-cyan-700",
    "97": "text-gray-900",
    "0": "text-black", // reset to black
  };

  let match;
  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index);
      parts.push(
        <span key={lastIndex} className={currentColor}>
          {textPart}
        </span>,
      );
    }

    const code = match[1];
    currentColor = colorMap[code] || "";
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={lastIndex} className={currentColor}>
        {text.slice(lastIndex)}
      </span>,
    );
  }

  return parts.length > 0 ? parts : [text];
}

interface ServerInstance {
  id: string;
  command: string;
  status: "idle" | "starting" | "running" | "error";
  logs: string[];
  url?: string;
}

function ProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectPath = searchParams.get("path");
  const commandsParam = searchParams.get("commands");
  const autoStartParam = searchParams.get("autoStart");
  const { api } = useElectronAPI();

  const [commands, setCommands] = useState<string[]>(
    commandsParam ? commandsParam.split(",") : [],
  );
  const [servers, setServers] = useState<ServerInstance[]>(
    commands.map((cmd) => ({
      id: "",
      command: cmd,
      status: "idle",
      logs: [],
    })),
  );
  const [devToolsLogs, setDevToolsLogs] = useState<
    Array<{ message: string; type: string; source: string; line: number }>
  >([]);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [browserViewReady, setBrowserViewReady] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("devtools");
  const [autoStartPending, setAutoStartPending] = useState(
    autoStartParam === "true",
  );
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [browserTabs, setBrowserTabs] = useState<
    Array<{ id: string; title: string; url: string; isActive: boolean }>
  >([]);
  const [activeBrowserTabId, setActiveBrowserTabId] = useState<string | null>(
    null,
  );
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Map server IDs to their index for log routing before IDs are assigned
  const serverIdMapRef = useRef<Map<string, number>>(new Map());

  // Derived state
  const firstRunningServer = servers.find((s) => s.status === "running");
  const anyServerRunning = servers.some((s) => s.status === "running");

  // Function to handle back navigation - stops all servers before navigating
  const handleBackToHome = useCallback(async () => {
    console.log("🏠 Returning to home - stopping all servers...");
    
    try {
      if (api?.stopAllServers) {
        await api.stopAllServers();
        console.log("✅ All servers stopped successfully");
      }
    } catch (error) {
      console.error("❌ Error stopping servers:", error);
    }
    
    // Navigate to home page
    router.push("/");
  }, [api, router]);

  // Function to start all servers
  const startAllServers = useCallback(async () => {
    if (!api || !projectPath) return;

    console.log(
      `[startAllServers] Starting ${commands.length} servers:`,
      commands,
    );

    // Start ALL servers in parallel using Promise.all()
    const startPromises = commands.map(async (command, i) => {
      console.log(`[startAllServers] Starting server ${i}: ${command}`);

      const port = 48100 + i;

      try {
        setServers((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? { ...s, status: "starting", logs: [`Starting: ${command}...`] }
              : s,
          ),
        );

        // Pass index to main process so it can be included in response
        const result = await api.startServer(projectPath, command, port, i);

        // Register ID -> index mapping IMMEDIATELY when promise resolves
        // Also check if clientIndex is returned from backend
        const serverIndex =
          result.clientIndex !== undefined ? result.clientIndex : i;
        serverIdMapRef.current.set(result.id, serverIndex);
        console.log(
          `🗺️ Registered server ID mapping: ${result.id} -> index ${serverIndex}`,
        );

        setServers((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, id: result.id } : s)),
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
              : s,
          ),
        );
        return { success: false, index: i, error: err };
      }
    });

    // Wait for all servers to start simultaneously
    await Promise.all(startPromises);
  }, [api, projectPath, commands]);

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

  // Load commands from cache if not in URL
  useEffect(() => {
    const loadCommandsFromCache = async () => {
      if (!projectPath || commandsParam || !api?.analyzeProject) return;

      try {
        console.log("[Project] Loading commands from cache for:", projectPath);
        const analysis = await api.analyzeProject(projectPath);

        // Check if cache entry has commands
        if (analysis.commands && analysis.commands.length > 0) {
          console.log("[Project] Found cached commands:", analysis.commands);
          setCommands(analysis.commands);

          // Initialize servers with cached commands
          const initializedServers = analysis.commands.map((cmd) => ({
            id: "",
            command: cmd,
            status: "idle" as const,
            logs: [],
          }));
          console.log("[Project] Initializing servers:", initializedServers);
          setServers(initializedServers);

          // Mark that we need to auto-start servers
          console.log("[Project] Marking servers for auto-start");
          setAutoStartPending(true);
        }
      } catch (error) {
        console.error("[Project] Failed to load commands from cache:", error);
      }
    };

    loadCommandsFromCache();
  }, [projectPath, commandsParam, api]);

  // Auto-start servers when loaded from cache
  useEffect(() => {
    if (autoStartPending && commands.length > 0 && api) {
      console.log("[Project] Auto-starting servers:", commands);
      setAutoStartPending(false);

      // Small delay to ensure servers state is initialized
      setTimeout(() => {
        startAllServers();
      }, 100);
    }
  }, [autoStartPending, commands, api, startAllServers]);

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
      if (
        !browserViewReady ||
        !firstRunningServer?.url ||
        !api?.navigateBrowserView
      )
        return;

      try {
        console.log(
          `🔗 Navigating embedded preview to ${firstRunningServer.url}`,
        );
        await api.navigateBrowserView(firstRunningServer.url);
        // Check navigation state after navigation
        if (api?.canNavigateBrowserView) {
          const navState = await api.canNavigateBrowserView();
          setCanGoBack(navState.canGoBack);
          setCanGoForward(navState.canGoForward);
        }
      } catch (error) {
        console.error("Failed to navigate BrowserView:", error);
      }
    };

    navigateToServer();
  }, [browserViewReady, firstRunningServer?.url, api?.navigateBrowserView]);

  // Set up server event listeners ONCE when component mounts
  useEffect(() => {
    if (!api) return;

    console.log("🎧 Setting up server event listeners");

    // Listen for server ready event
    if (api.onServerReady) {
      api.onServerReady((server: any) => {
        console.log("📡 Received server:ready event", server);

        // Use clientIndex from backend if available, fallback to ID map
        let serverIndex = server.clientIndex;
        if (serverIndex === undefined) {
          serverIndex = serverIdMapRef.current.get(server.id);
        }

        console.log(
          `🔍 Server ready routing: ${server.id} -> index ${serverIndex} (from ${server.clientIndex !== undefined ? "backend" : "map"})`,
        );

        setServers((prev) =>
          prev.map((s, idx) => {
            // Match by ID or by index (prioritize clientIndex from backend)
            if (
              s.id === server.id ||
              (serverIndex !== undefined && idx === serverIndex)
            ) {
              console.log(
                `✅ Matched server at index ${idx}, marking as running`,
              );
              return {
                ...s,
                id: server.id, // Update ID if it wasn't set
                status: "running",
                url: `http://localhost:${server.port}`,
              };
            }
            return s;
          }),
        );

        // Auto-switch to first server tab when it becomes ready
        if (serverIndex === 0) {
          console.log(`🔀 Auto-switching to server-0 tab`);
          setActiveTab(`server-0`);
        }
      });
    }

    // Listen for server stopped event
    if (api.onServerStopped) {
      api.onServerStopped((stoppedId: string) => {
        console.log("📡 Received server:stopped event", stoppedId);
        setServers((prev) =>
          prev.map((s) =>
            s.id === stoppedId
              ? { ...s, status: "idle", logs: [...s.logs, "Server stopped"] }
              : s,
          ),
        );
      });
    }

    // Listen for server logs
    if (api.onServerLog) {
      api.onServerLog(
        (logData: {
          id: string;
          log: string;
          type: string;
          clientIndex?: number;
        }) => {
          console.log("📋 Received server log:", logData);

          // Use clientIndex from backend if available, fallback to ID map
          let serverIndex = logData.clientIndex;
          if (serverIndex === undefined) {
            serverIndex = serverIdMapRef.current.get(logData.id);
          }

          console.log(
            `🔍 Server routing: ${logData.id} -> index ${serverIndex} (from ${logData.clientIndex !== undefined ? "backend" : "map"})`,
          );

          setServers((prev) => {
            const updated = prev.map((s, idx) => {
              // Match by ID or by index (prioritize clientIndex from backend)
              if (
                s.id === logData.id ||
                (serverIndex !== undefined && idx === serverIndex)
              ) {
                console.log(`✅ Matched server at index ${idx}, adding log`);
                return { ...s, logs: [...s.logs, logData.log] };
              }
              return s;
            });
            console.log(
              "📊 Updated servers state:",
              updated.map((s) => ({ id: s.id, logsCount: s.logs.length })),
            );
            return updated;
          });
        },
      );
    }

    // Listen for browser console logs
    if (api.onBrowserConsoleLog) {
      api.onBrowserConsoleLog((logData) => {
        console.log("🌐 Received browser console log:", logData);
        setDevToolsLogs((prev) => [...prev, logData]);
      });
    }

    // Listen for tab updates
    if (api.onTabUpdated) {
      api.onTabUpdated((data) => {
        console.log("🔖 Tab updated:", data);
        setBrowserTabs((prev) =>
          prev.map((tab) =>
            tab.id === data.id
              ? { ...tab, title: data.title, url: data.url }
              : tab,
          ),
        );
      });
    }
  }, [api]);

  // Load initial tabs when browser view is ready
  useEffect(() => {
    const loadTabs = async () => {
      if (!api?.getTabs || !browserViewReady) return;

      try {
        const result = await api.getTabs();
        if (result.success && result.tabs) {
          console.log("📂 Loaded tabs:", result.tabs);
          setBrowserTabs(result.tabs);
          const activeTab = result.tabs.find((t) => t.isActive);
          if (activeTab) {
            setActiveBrowserTabId(activeTab.id);
          }
        }
      } catch (error) {
        console.error("Failed to load tabs:", error);
      }
    };

    loadTabs();
  }, [api, browserViewReady]);

  if (!projectPath) {
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
            onClick={handleBackToHome}
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
              {projectPath.split("/").pop() || "Project"}
            </h1>
            <p className="text-gray-500 text-[10px]">
              {servers.length} server{servers.length > 1 ? "s" : ""}
            </p>
          </div>

          {/* Browser Tabs */}
          {browserTabs.length > 0 && (
            <div className="flex items-center gap-1 ml-4 pl-4 border-l border-gray-300">
              {browserTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-3 py-1 rounded-md transition-colors cursor-pointer max-w-[200px] ${
                    tab.isActive || tab.id === activeBrowserTabId
                      ? "bg-gray-100 text-gray-900"
                      : "bg-white hover:bg-gray-50 text-gray-600"
                  }`}
                  onClick={async () => {
                    if (api?.switchTab && tab.id !== activeBrowserTabId) {
                      await api.switchTab(tab.id);
                      setActiveBrowserTabId(tab.id);
                    }
                  }}
                >
                  <span className="text-xs truncate">
                    {tab.title || "New Tab"}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (api?.closeTab && browserTabs.length > 1) {
                        await api.closeTab(tab.id);
                        setBrowserTabs((prev) =>
                          prev.filter((t) => t.id !== tab.id),
                        );
                        // If closed tab was active, switch to first remaining tab
                        if (tab.id === activeBrowserTabId) {
                          const remaining = browserTabs.filter(
                            (t) => t.id !== tab.id,
                          );
                          if (remaining.length > 0) {
                            await api.switchTab(remaining[0].id);
                            setActiveBrowserTabId(remaining[0].id);
                          }
                        }
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Close tab"
                  >
                    <svg
                      className="w-3 h-3"
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
              ))}
              {/* New Tab Button */}
              <button
                onClick={async () => {
                  if (!api?.createTab || !previewContainerRef.current) return;

                  const container = previewContainerRef.current;
                  const rect = container.getBoundingClientRect();

                  const xOffset = showTerminal ? 384 : 0;
                  const widthReduction = showTerminal ? 384 : 0;

                  try {
                    const result = await api.createTab({
                      x: Math.round(rect.left + xOffset),
                      y: Math.round(rect.top),
                      width: Math.round(rect.width - widthReduction),
                      height: Math.round(rect.height),
                    });

                    if (result.success) {
                      setBrowserTabs((prev) => [
                        ...prev,
                        {
                          id: result.tabId,
                          title: result.title,
                          url: result.url,
                          isActive: true,
                        },
                      ]);
                      setActiveBrowserTabId(result.tabId);
                    }
                  } catch (error) {
                    console.error("Failed to create new tab:", error);
                  }
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
                title="New tab"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {/* Browser Navigation Controls */}
          {browserViewReady && anyServerRunning && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={async () => {
                  if (api?.goBackBrowserView) {
                    const result = await api.goBackBrowserView();
                    if (api?.canNavigateBrowserView) {
                      const navState = await api.canNavigateBrowserView();
                      setCanGoBack(navState.canGoBack);
                      setCanGoForward(navState.canGoForward);
                    }
                  }
                }}
                disabled={!canGoBack}
                className={`p-1.5 rounded-md transition-colors ${
                  canGoBack
                    ? "hover:bg-gray-100 text-gray-700"
                    : "text-gray-400 cursor-not-allowed"
                }`}
                title="Go Back"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                onClick={async () => {
                  if (api?.goForwardBrowserView) {
                    const result = await api.goForwardBrowserView();
                    if (api?.canNavigateBrowserView) {
                      const navState = await api.canNavigateBrowserView();
                      setCanGoBack(navState.canGoBack);
                      setCanGoForward(navState.canGoForward);
                    }
                  }
                }}
                disabled={!canGoForward}
                className={`p-1.5 rounded-md transition-colors ${
                  canGoForward
                    ? "hover:bg-gray-100 text-gray-700"
                    : "text-gray-400 cursor-not-allowed"
                }`}
                title="Go Forward"
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
              <button
                onClick={async () => {
                  if (api?.reloadBrowserView) {
                    await api.reloadBrowserView();
                  }
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-700 transition-colors"
                title="Reload"
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1" />
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                anyServerRunning
                  ? "bg-green-500"
                  : servers.some((s) => s.status === "starting")
                    ? "bg-yellow-500 animate-pulse"
                    : servers.some((s) => s.status === "error")
                      ? "bg-red-500"
                      : "bg-gray-400"
              }`}
            />
            <span className="text-[10px] text-gray-600 font-medium">
              {anyServerRunning
                ? `${servers.filter((s) => s.status === "running").length}/${servers.length} Running`
                : servers.some((s) => s.status === "starting")
                  ? "Starting..."
                  : servers.some((s) => s.status === "error")
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
          {browserViewReady && !firstRunningServer && (
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
                <p className="text-gray-600">Waiting for servers...</p>
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
            <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
              <button
                onClick={() => setActiveTab("devtools")}
                className={`px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === "devtools"
                    ? "text-gray-900 border-b-2 border-gray-900 bg-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                DevTools
              </button>
              {servers.map((server, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTab(`server-${index}`)}
                  className={`px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === `server-${index}`
                      ? "text-gray-900 border-b-2 border-gray-900 bg-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        server.status === "running"
                          ? "bg-green-500"
                          : server.status === "starting"
                            ? "bg-yellow-500"
                            : server.status === "error"
                              ? "bg-red-500"
                              : "bg-gray-400"
                      }`}
                    />
                    Server {index + 1}
                  </div>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-white">
              {activeTab === "devtools" ? (
                <>
                  {devToolsLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`mb-1 leading-relaxed ${
                        log.type === "error"
                          ? "text-red-600"
                          : log.type === "warning"
                            ? "text-yellow-700"
                            : log.type === "debug"
                              ? "text-blue-600"
                              : "text-black"
                      }`}
                    >
                      <span className="text-gray-600 mr-2">[{log.type}]</span>
                      {log.message}
                    </div>
                  ))}
                  {devToolsLogs.length === 0 && (
                    <div className="text-gray-500 text-sm">
                      No console logs yet. Open your app in the preview to see
                      console output.
                    </div>
                  )}
                </>
              ) : (
                <>
                  {servers.map((server, index) =>
                    activeTab === `server-${index}` ? (
                      <div key={index}>
                        <div className="mb-2 pb-2 border-b border-gray-200">
                          <div className="text-gray-700 text-xs font-semibold mb-1">
                            Command: {server.command}
                          </div>
                          {server.url && (
                            <div className="text-blue-600 text-xs">
                              URL: {server.url}
                            </div>
                          )}
                        </div>
                        {server.logs.map((log, logIndex) => (
                          <div
                            key={logIndex}
                            className="mb-1 leading-relaxed font-mono text-sm text-black"
                          >
                            {parseLogLine(log)}
                          </div>
                        ))}
                        {server.logs.length === 0 && (
                          <div className="text-gray-500 text-sm">
                            No logs yet for this server.
                          </div>
                        )}
                      </div>
                    ) : null,
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
