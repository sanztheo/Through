"use client";

import { useState, useEffect } from "react";
import { useElectronAPI } from "@/hooks/useElectronAPI";
import type { FileNode } from "@/types/electron";

export function useProjectFiles(projectPath: string) {
  const { api } = useElectronAPI();
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!api || !projectPath) return;

    let isMounted = true;

    const fetchFiles = async () => {
      try {
        const nodes = await api.listProjectFiles(projectPath);
        
        const flatten = (nodes: FileNode[]): string[] => {
          let result: string[] = [];
          for (const node of nodes) {
            if (node.type === "file") {
              // Convert absolute path to relative if possible, or just keep name
              // Actually we want the relative path for the agent
              // listProjectFiles usually returns absolute paths
              // We'll trust the node structure. If path is absolute, we might need to make it relative.
              // Let's store the node.path for now. Ideally we want relative paths.
              // If node.path starts with projectPath, slice it.
              let relativePath = node.path;
              if (node.path.startsWith(projectPath)) {
                relativePath = node.path.slice(projectPath.length);
                if (relativePath.startsWith("/")) relativePath = relativePath.slice(1);
              }
              result.push(relativePath);
            } else if (node.children) {
              result = [...result, ...flatten(node.children)];
            }
          }
          return result;
        };

        const flatFiles = flatten(nodes);
        if (isMounted) setFiles(flatFiles);
      } catch (error) {
        console.error("Failed to list files:", error);
      }
    };

    fetchFiles();

    return () => {
      isMounted = false;
    };
  }, [api, projectPath]);

  return files;
}
