"use client";

import { useState, useEffect } from "react";
import { File, Folder, ChevronRight, ChevronDown } from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

interface FileExplorerProps {
  projectPath: string;
}

export function FileExplorer({ projectPath }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, [projectPath]);

  const loadFiles = async () => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    setIsLoading(true);
    try {
      const result = await window.electronAPI.listProjectFiles(projectPath);
      setFiles(result);
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFolder = (path: string) => {
    const updated = new Set(expandedFolders);
    if (updated.has(path)) {
      updated.delete(path);
    } else {
      updated.add(path);
    }
    setExpandedFolders(updated);
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const paddingLeft = depth * 20 + 12;

    if (node.type === "folder") {
      return (
        <div key={node.path}>
          <button
            onClick={() => toggleFolder(node.path)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            <Folder className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-700">{node.name}</span>
          </button>
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors"
        style={{ paddingLeft: `${paddingLeft + 24}px` }}
      >
        <File className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">{node.name}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading files...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {files.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-gray-400">No files found</p>
        </div>
      ) : (
        <div className="py-2">{files.map((node) => renderNode(node))}</div>
      )}
    </div>
  );
}
