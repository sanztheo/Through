"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useElectronAPI } from "@/hooks/useElectronAPI";
import { Folder, GitBranch } from "lucide-react";

interface ProjectInfo {
  path: string;
  name: string;
  framework: string;
  startCommand: string;
  port: number;
  analyzedAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const { isElectron, api } = useElectronAPI();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectInfo[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    project: ProjectInfo;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("recentProjects");
    if (stored) {
      setRecentProjects(JSON.parse(stored));
    }
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  const saveProject = (project: ProjectInfo) => {
    const updated = [
      project,
      ...recentProjects.filter((p) => p.path !== project.path),
    ].slice(0, 10);
    setRecentProjects(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("recentProjects", JSON.stringify(updated));
    }
  };

  const handleOpenProject = async () => {
    if (!api) return;

    try {
      setIsLoading(true);
      setError(null);
      const folderPath = await api.selectFolder();

      if (folderPath) {
        const analysis = await api.analyzeProject(folderPath);
        console.log("Analysis result:", analysis);

        const projectInfo: ProjectInfo = {
          path: analysis.projectPath,
          name: analysis.projectPath.split("/").pop() || "Unknown",
          framework: analysis.detection.framework,
          startCommand: analysis.detection.startCommand,
          port: analysis.detection.defaultPort,
          analyzedAt: analysis.analyzedAt,
        };

        saveProject(projectInfo);
        router.push(
          `/project?path=${encodeURIComponent(analysis.projectPath)}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select folder");
      console.error("Error selecting folder:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectClick = (project: ProjectInfo) => {
    router.push(`/project?path=${encodeURIComponent(project.path)}`);
  };

  const handleContextMenu = (e: React.MouseEvent, project: ProjectInfo) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      project,
    });
  };

  const handleDeleteProject = async (project: ProjectInfo) => {
    if (!api) return;

    try {
      // Invalider le cache du projet
      await api.invalidateCache(project.path);

      // Supprimer du localStorage
      const updated = recentProjects.filter((p) => p.path !== project.path);
      setRecentProjects(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("recentProjects", JSON.stringify(updated));
      }

      setContextMenu(null);
    } catch (err) {
      console.error("Error deleting project:", err);
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-12 font-sans">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center justify-center mb-16">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-black">
              Inspector
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button className="hover:text-gray-700 transition-colors">
              Business
            </button>
            <span>·</span>
            <button className="hover:text-gray-700 transition-colors">
              Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mb-16">
          <button
            onClick={handleOpenProject}
            disabled={!isElectron || isLoading}
            className="bg-gray-50 hover:bg-gray-100 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg p-6 flex flex-col items-start gap-3 transition-colors"
          >
            <Folder className="w-6 h-6 text-gray-600" />
            <span className="text-base font-medium text-black">
              Open project
            </span>
          </button>

          <button
            disabled
            className="bg-gray-50 cursor-not-allowed rounded-lg p-6 flex flex-col items-start gap-3 opacity-50"
          >
            <GitBranch className="w-6 h-6 text-gray-600" />
            <span className="text-base font-medium text-black">Clone repo</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
            <p className="text-gray-600 text-sm">Analyzing project...</p>
          </div>
        )}

        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-black">Recent projects</h2>
            <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              View all ({recentProjects.length})
            </button>
          </div>

          {recentProjects.length > 0 ? (
            <div className="space-y-1">
              {recentProjects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => handleProjectClick(project)}
                  onContextMenu={(e) => handleContextMenu(e, project)}
                  className="w-full hover:bg-gray-50 rounded-md p-3 flex justify-between items-center transition-colors cursor-pointer"
                >
                  <span className="font-medium text-black text-sm">
                    {project.name}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {project.path}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-sm">No recent projects yet</p>
              <p className="text-gray-400 text-xs mt-2">
                Open a project to get started
              </p>
            </div>
          )}
        </div>

        {!isElectron && (
          <div className="text-center text-gray-400 text-xs mt-8">
            Please run this app in Electron
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleDeleteProject(contextMenu.project)}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete project
          </button>
        </div>
      )}
    </main>
  );
}
