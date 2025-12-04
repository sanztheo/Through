"use client";

import React from "react";

interface DevToolsLog {
  message: string;
  type: string;
  source: string;
  line: number;
}

interface DevToolsLogsProps {
  logs: DevToolsLog[];
}

export function DevToolsLogs({ logs }: DevToolsLogsProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
      {logs.map((log, index) => (
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
      {logs.length === 0 && (
        <div className="text-gray-500 text-sm">
          No console logs yet. Open your app in the preview to see console
          output.
        </div>
      )}
    </div>
  );
}
