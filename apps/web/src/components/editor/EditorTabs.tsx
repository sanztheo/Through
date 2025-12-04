"use client";

import React from "react";
import { X } from "lucide-react";
import { FileIcon } from "./FileIcon";

export interface EditorTab {
  id: string;
  filename: string;
  path: string;
  content: string;
  originalContent: string;
  isModified: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function EditorTabs({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
}: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center bg-gray-100 border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          className={`group flex items-center gap-2 px-3 py-2 border-r border-gray-200 cursor-pointer transition-colors min-w-0 ${
            activeTabId === tab.id
              ? "bg-white text-gray-900"
              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
          }`}
        >
          <FileIcon filename={tab.filename} className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium truncate max-w-[120px]">
            {tab.filename}
          </span>
          {tab.isModified && (
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            className="p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
