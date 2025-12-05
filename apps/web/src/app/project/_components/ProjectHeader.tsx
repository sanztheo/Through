import React from "react";
import {
  ArrowLeft,
  Plus,
  X,
  Globe,
  Code2,
  Server,
  Terminal,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  MousePointerClick,
  MessageSquare,
} from "lucide-react";
import { ServerInstance } from "../_types";
import { EditorTab } from "@/components/editor";

interface ProjectHeaderProps {
  projectPath: string | null;
  servers: ServerInstance[];
  browserTabs: Array<{ id: string; title: string; url: string; isActive: boolean }>;
  activeBrowserTabId: string | null;
  editorTabs: EditorTab[];
  activeEditorTabId: string | null;
  viewMode: "browser" | "editor";
  browserViewReady: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  showTerminal: boolean;
  isInspecting: boolean;
  onBackToHome: () => void;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onEditorTabClick: (tabId: string) => void;
  onEditorTabClose: (tabId: string) => void;
  onSwitchToBrowser: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onToggleTerminal: () => void;
  onToggleInspector: () => void;
  onToggleChat: () => void;
  isChatOpen?: boolean;
  pendingModificationsCount?: number;
}

export function ProjectHeader({
  projectPath,
  servers,
  browserTabs,
  activeBrowserTabId,
  editorTabs,
  activeEditorTabId,
  viewMode,
  browserViewReady,
  canGoBack,
  canGoForward,
  showTerminal,
  isInspecting,
  onBackToHome,
  onTabClick,
  onTabClose,
  onNewTab,
  onEditorTabClick,
  onEditorTabClose,
  onSwitchToBrowser,
  onGoBack,
  onGoForward,
  onReload,
  onToggleTerminal,
  onToggleInspector,
  onToggleChat,
  isChatOpen = false,
  pendingModificationsCount = 0,
}: ProjectHeaderProps) {
  const anyServerRunning = servers.some((s) => s.status === "running");

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-200 bg-white z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onBackToHome}
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
            {projectPath?.split("/").pop() || "Project"}
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
                onClick={() => onTabClick(tab.id)}
              >
                <span className="text-xs truncate">
                  {tab.title || "New Tab"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
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
              onClick={onNewTab}
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

        {/* Editor Tabs */}
        {editorTabs.length > 0 && (
          <div className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-2">
            {editorTabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => onEditorTabClick(tab.id)}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
                  viewMode === "editor" && activeEditorTabId === tab.id
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span className="max-w-[100px] truncate">{tab.filename}</span>
                {tab.isModified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditorTabClose(tab.id);
                  }}
                  className={`p-0.5 rounded-sm hover:bg-black/10 transition-colors ml-1 ${
                    viewMode === "editor" && activeEditorTabId === tab.id
                      ? "opacity-60 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-60"
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {viewMode === "editor" && (
              <button
                onClick={onSwitchToBrowser}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors ml-1"
                title="Back to Browser"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        {/* Browser Navigation Controls */}
        {browserViewReady && anyServerRunning && (
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={onGoBack}
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
              onClick={onGoForward}
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
              onClick={onReload}
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
          onClick={onToggleInspector}
          className={`p-1.5 rounded-md transition-colors relative ${
            isInspecting
              ? "bg-blue-100 text-blue-600"
              : "bg-white hover:bg-gray-100 text-gray-600"
          }`}
          title="Inspect Element"
        >
          <MousePointerClick className="w-4 h-4" />
          {pendingModificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {pendingModificationsCount}
            </span>
          )}
        </button>
        <button
          onClick={onToggleChat}
          className={`p-1.5 rounded-md transition-colors ${
            isChatOpen
              ? "bg-blue-100 text-blue-600"
              : "bg-white hover:bg-gray-100 text-gray-600"
          }`}
          title="AI Chat"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleTerminal}
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
  );
}
