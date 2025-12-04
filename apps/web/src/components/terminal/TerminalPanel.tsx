"use client";

import React, { useState } from "react";
import { FolderTree } from "lucide-react";
import { DevToolsLogs } from "./DevToolsLogs";
import { ServerLogs } from "./ServerLogs";
import { FileExplorer } from "../FileExplorer";

interface DevToolsLog {
  message: string;
  type: string;
  source: string;
  line: number;
}

interface ServerInstance {
  id: string;
  command: string;
  status: "idle" | "starting" | "running" | "error";
  logs: string[];
  url?: string;
}

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ServerInstance[];
  devToolsLogs: DevToolsLog[];
  projectPath: string;
  onRestartServer: (index: number) => void;
  onFileOpen?: (path: string, filename: string) => void;
}

export function TerminalPanel({
  isOpen,
  onClose,
  servers,
  devToolsLogs,
  projectPath,
  onRestartServer,
  onFileOpen,
}: TerminalPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("devtools");

  // Don't render if not open (instead of translate off-screen)
  if (!isOpen) return null;

  return (
    <div className="w-96 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <h2 className="text-gray-900 font-semibold text-sm">Terminal</h2>
          <button
            onClick={onClose}
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
          <button
            onClick={() => setActiveTab("files")}
            className={`px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === "files"
                ? "text-gray-900 border-b-2 border-gray-900 bg-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5" />
              Files
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {activeTab === "devtools" && <DevToolsLogs logs={devToolsLogs} />}

          {servers.map((server, index) =>
            activeTab === `server-${index}` ? (
              <ServerLogs
                key={index}
                server={server}
                serverIndex={index}
                onRestart={onRestartServer}
              />
            ) : null,
          )}

          {activeTab === "files" && (
            <div className="flex-1 overflow-hidden">
              <FileExplorer projectPath={projectPath} onFileOpen={onFileOpen} />
            </div>
          )}
        </div>
      </div>
  );
}
