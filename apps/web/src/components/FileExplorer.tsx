"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
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

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null;
}

export function FileExplorer({ projectPath, onFileOpen }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [renamingNode, setRenamingNode] = useState<FileNode | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFiles();
  }, [projectPath]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    if (contextMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu.visible]);

  // Focus rename input when renaming
  useEffect(() => {
    if (renamingNode && renameInputRef.current) {
      renameInputRef.current.focus();
      // Select filename without extension for files
      if (renamingNode.type === "file") {
        const lastDot = renameValue.lastIndexOf(".");
        if (lastDot > 0) {
          renameInputRef.current.setSelectionRange(0, lastDot);
        } else {
          renameInputRef.current.select();
        }
      } else {
        renameInputRef.current.select();
      }
    }
  }, [renamingNode]);

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

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleRename = () => {
    if (contextMenu.node) {
      setRenamingNode(contextMenu.node);
      setRenameValue(contextMenu.node.name);
    }
    closeContextMenu();
  };

  const handleRenameSubmit = async () => {
    if (!renamingNode || !renameValue.trim()) {
      setRenamingNode(null);
      return;
    }

    if (renameValue === renamingNode.name) {
      setRenamingNode(null);
      return;
    }

    try {
      const parentPath = renamingNode.path.substring(
        0,
        renamingNode.path.lastIndexOf("/"),
      );
      const newPath = `${parentPath}/${renameValue}`;

      const result = await window.electronAPI.renameFile(
        renamingNode.path,
        newPath,
      );

      if (result.success) {
        await loadFiles();
      } else {
        console.error("Failed to rename:", result.error);
        alert(`Failed to rename: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to rename:", error);
    } finally {
      setRenamingNode(null);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenamingNode(null);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu.node) return;

    const node = contextMenu.node;
    const isFolder = node.type === "folder";
    const confirmMessage = isFolder
      ? `Are you sure you want to delete the folder "${node.name}" and all its contents?`
      : `Are you sure you want to delete "${node.name}"?`;

    closeContextMenu();

    if (!confirm(confirmMessage)) return;

    try {
      const result = await window.electronAPI.deleteFile(node.path);

      if (result.success) {
        await loadFiles();
      } else {
        console.error("Failed to delete:", result.error);
        alert(`Failed to delete: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleCopyPath = () => {
    if (contextMenu.node) {
      navigator.clipboard.writeText(contextMenu.node.path);
    }
    closeContextMenu();
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const paddingLeft = depth * 16 + 8;
    const isRenaming = renamingNode?.path === node.path;

    if (node.type === "folder") {
      return (
        <div key={node.path}>
          <button
            onClick={() => toggleFolder(node.path)}
            onContextMenu={(e) => handleContextMenu(e, node)}
            className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 transition-colors text-left group"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
                className="flex-1 text-sm bg-white border border-blue-500 rounded px-1 py-0.5 outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm text-gray-700 truncate">
                {node.name}
              </span>
            )}
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
        onClick={() => !isRenaming && handleFileClick(node)}
        onContextMenu={(e) => handleContextMenu(e, node)}
        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 transition-colors text-left group"
        style={{ paddingLeft: `${paddingLeft + 20}px` }}
      >
        <FileIcon filename={node.name} className="w-4 h-4 flex-shrink-0" />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            className="flex-1 text-sm bg-white border border-blue-500 rounded px-1 py-0.5 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm text-gray-600 truncate">{node.name}</span>
        )}
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
    <div className="h-full overflow-y-auto relative">
      {files.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-gray-400">No files found</p>
        </div>
      ) : (
        <div className="py-1">{files.map((node) => renderNode(node))}</div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            onClick={handleRename}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Rename
          </button>
          <button
            onClick={handleCopyPath}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy Path
          </button>
          <div className="h-px bg-gray-200 my-1" />
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
