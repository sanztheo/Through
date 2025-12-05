"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useElectronAPI } from "@/hooks/useElectronAPI";
import { TerminalPanel } from "@/components/terminal";
import { CodeEditorPanel } from "@/components/editor";

import { useProjectServers } from "./_hooks/useProjectServers";
import { useBrowserView } from "./_hooks/useBrowserView";
import { useEditor } from "./_hooks/useEditor";
import { useElementInspector } from "./_hooks/useElementInspector";
import { ProjectHeader } from "./_components/ProjectHeader";
import { ElementInspectorPanel } from "./_components/ElementInspectorPanel";

function ProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectPath = searchParams.get("path");
  const commandsParam = searchParams.get("commands");
  const autoStartParam = searchParams.get("autoStart");
  const { api } = useElectronAPI();

  const [showTerminal, setShowTerminal] = useState(false);

  // Custom hooks
  const {
    servers,
    devToolsLogs,
    startAllServers,
    restartServer,
  } = useProjectServers({
    projectId: projectPath,
    commandsParam,
    autoStartParam,
    api,
  });

  const firstRunningServer = servers.find((s) => s.status === "running");

  const {
    editorTabs,
    activeEditorTabId,
    viewMode,
    setViewMode,
    setActiveEditorTabId,
    handleFileOpen,
    handleEditorContentChange,
    handleEditorTabClose,
    handleEditorSave,
  } = useEditor({ api });

  const {
    browserViewReady,
    previewContainerRef,
    canGoBack,
    canGoForward,
    browserTabs,
    activeBrowserTabId,
    handleTabClick,
    handleTabClose,
    handleNewTab,
    handleGoBack,
    handleGoForward,
    handleReload,
  } = useBrowserView({
    api,
    showTerminal,
    viewMode,
    firstRunningServer,
  });

  // Element Inspector
  const {
    isInspecting,
    selectedElement,
    toggleInspector,
    clearSelection,
  } = useElementInspector({ api });

  // Handle back navigation
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
    
    router.push("/");
  }, [api, router]);


  if (!projectPath) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1e293b]">
        <div className="text-white">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
      <ProjectHeader
        projectPath={projectPath}
        servers={servers}
        browserTabs={browserTabs}
        activeBrowserTabId={activeBrowserTabId}
        editorTabs={editorTabs}
        activeEditorTabId={activeEditorTabId}
        viewMode={viewMode}
        browserViewReady={browserViewReady}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        showTerminal={showTerminal}
        isInspecting={isInspecting}
        onBackToHome={handleBackToHome}
        onTabClick={(tabId) => {
          handleTabClick(tabId);
          setViewMode("browser");
        }}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
        onEditorTabClose={handleEditorTabClose}
        onEditorTabClick={(tabId) => {
          setActiveEditorTabId(tabId);
          setViewMode("editor");
        }}
        onSwitchToBrowser={() => setViewMode("browser")}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onToggleTerminal={() => setShowTerminal(!showTerminal)}
        onToggleInspector={toggleInspector}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Terminal Sidebar */}
        <TerminalPanel
          isOpen={showTerminal}
          onClose={() => setShowTerminal(false)}
          servers={servers}
          devToolsLogs={devToolsLogs}
          projectPath={projectPath || ""}
          onRestartServer={restartServer}
          onFileOpen={handleFileOpen}
        />

        {/* Browser Preview */}
        {viewMode === "browser" && (
          <div 
            ref={previewContainerRef}
            className="flex-1 flex flex-col bg-gray-50"
          >
            {!browserViewReady && (
              <div className="flex-1 flex items-center justify-center">
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
                  <p className="text-gray-600">Initializing browser...</p>
                </div>
              </div>
            )}
            {browserViewReady && !firstRunningServer && (
              <div className="flex-1 flex items-center justify-center">
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
                  <p className="text-gray-600">
                    {servers.some((s) => s.status === "starting")
                      ? "Starting server..."
                      : "Waiting for servers..."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Code Editor Panel */}
        {viewMode === "editor" && editorTabs.length > 0 && (
          <div className="flex-1 flex flex-col bg-white">
            <CodeEditorPanel
              tabs={editorTabs}
              activeTabId={activeEditorTabId}
              onTabClick={(tabId) => {
                setActiveEditorTabId(tabId);
              }}
              onTabClose={handleEditorTabClose}
              onContentChange={handleEditorContentChange}
              onSave={handleEditorSave}
            />
          </div>
        )}

        {/* Element Inspector Panel */}
        {selectedElement && (
          <ElementInspectorPanel
            element={selectedElement}
            onClose={clearSelection}
          />
        )}
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
