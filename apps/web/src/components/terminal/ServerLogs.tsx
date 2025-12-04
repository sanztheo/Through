"use client";

import React from "react";

// Parse ANSI color codes to styled spans
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
    "0": "text-black",
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

interface ServerLogsProps {
  server: ServerInstance;
  serverIndex: number;
  onRestart: (index: number) => void;
}

export function ServerLogs({ server, serverIndex, onRestart }: ServerLogsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="flex-shrink-0 p-4 pb-2 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-gray-700 text-xs font-semibold mb-1">
              Command: {server.command}
            </div>
            {server.url && (
              <div className="text-blue-600 text-xs">URL: {server.url}</div>
            )}
          </div>
          <button
            onClick={() => onRestart(serverIndex)}
            disabled={server.status === "starting"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              server.status === "starting"
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-orange-100 text-orange-700 hover:bg-orange-200"
            }`}
            title="Stop and restart this server"
          >
            <svg
              className={`w-3.5 h-3.5 ${server.status === "starting" ? "animate-spin" : ""}`}
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
            {server.status === "starting" ? "Restarting..." : "Restart"}
          </button>
        </div>
      </div>

      {/* Scrollable Logs */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {server.logs.map((log, logIndex) => (
          <div
            key={logIndex}
            className="mb-1 leading-relaxed text-sm text-black"
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
    </div>
  );
}
