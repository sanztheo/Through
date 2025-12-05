"use client";

import React from "react";
import { ChevronDown, ChevronRight, FileText, Search, FolderOpen, Terminal, Edit } from "lucide-react";

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "running" | "completed" | "error";
}

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  readFile: <FileText className="w-4 h-4" />,
  writeFile: <Edit className="w-4 h-4" />,
  replaceInFile: <Edit className="w-4 h-4" />,
  searchProject: <Search className="w-4 h-4" />,
  searchInProject: <Search className="w-4 h-4" />,
  listFiles: <FolderOpen className="w-4 h-4" />,
  runCommand: <Terminal className="w-4 h-4" />,
};

const TOOL_LABELS: Record<string, string> = {
  readFile: "Reading file",
  writeFile: "Writing file",
  replaceInFile: "Editing file",
  searchProject: "Searching",
  searchInProject: "Searching project",
  listFiles: "Listing files",
  runCommand: "Running command",
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const icon = TOOL_ICONS[toolCall.name] || <Terminal className="w-4 h-4" />;
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;
  
  const statusColor = {
    running: "text-yellow-500 bg-yellow-500/10",
    completed: "text-green-500 bg-green-500/10",
    error: "text-red-500 bg-red-500/10",
  }[toolCall.status];

  const argString = Object.entries(toolCall.args || {})
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 my-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className={`p-1 rounded ${statusColor}`}>{icon as React.ReactNode}</span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-400 truncate flex-1">{argString}</span>
        {toolCall.status === "running" && (
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 text-xs">
          <div className="bg-gray-900 text-gray-100 rounded p-2 font-mono overflow-x-auto">
            <div className="text-gray-400 mb-1">// Args</div>
            <pre>{JSON.stringify(toolCall.args || {}, null, 2)}</pre>
            {toolCall.result !== undefined && toolCall.result !== null && (
              <>
                <div className="text-gray-400 mt-2 mb-1">// Result</div>
                <pre className="text-green-400">
                  {JSON.stringify(toolCall.result, null, 2).slice(0, 500)}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
