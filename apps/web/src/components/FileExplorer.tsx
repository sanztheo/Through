"use client";

import { useState, useEffect } from "react";
import { Folder, ChevronRight, ChevronDown } from "lucide-react";
import { FileIcon } from "./editor/FileIcon";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

interface FileExplorerProps {
  projectPath: string;
  onFileOpen?: (path: string, filename: string) => void;
}

export function FileExplorer({ projectPath, onFileOpen }: FileExplorerProps) {
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

  const handleFileClick = (node: FileNode) => {
    if (onFileOpen) {
      onFileOpen(node.path, node.name);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const paddingLeft = depth * 16 + 8;

    if (node.type === "folder") {
      return (
        <div key={node.path}>
          <button
            onClick={() => toggleFolder(node.path)}
            className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 transition-colors text-left"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-gray-700 truncate">{node.name}</span>
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
      <button
        key={node.path}
        onClick={() => handleFileClick(node)}
        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 transition-colors text-left"
        style={{ paddingLeft: `${paddingLeft + 20}px` }}
      >
        <FileIcon filename={node.name} className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm text-gray-600 truncate">{node.name}</span>
      </button>
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
        <div className="py-1">{files.map((node) => renderNode(node))}</div>
      )}
    </div>
  );
}
