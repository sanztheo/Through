"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useElectronAPI } from "@/hooks/useElectronAPI";
import { Folder, GitBranch } from "lucide-react";
import { ProjectList } from "@/components/ProjectList";
import { ContextMenu } from "@/components/ContextMenu";
import { ProjectSetupModal } from "@/components/ProjectSetupModal";
import { SettingsModal } from "@/components/SettingsModal";

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
  const [selectedProject, setSelectedProject] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

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
        const projectName = folderPath.split("/").pop() || "Unknown";
        setSelectedProject({ path: folderPath, name: projectName });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select folder");
      console.error("Error selecting folder:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectSetupSubmit = async (commands: string[]) => {
    if (!selectedProject || !api) return;

    try {
      // Save project to recent list
      const projectInfo: ProjectInfo = {
        path: selectedProject.path,
        name: selectedProject.name,
        framework: "Custom", // Will be detected by commands
        startCommand: commands[0] || "npm run dev",
        port: 3000, // Default port
        analyzedAt: new Date().toISOString(),
      };

      saveProject(projectInfo);

      // Navigate to project page with commands and auto-start flag
      const searchParams = new URLSearchParams({
        path: selectedProject.path,
        commands: commands.join(","),
        autoStart: "true", // Signal that servers should start immediately
      });
      router.push(`/project?${searchParams.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to setup project");
      console.error("Error setting up project:", err);
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
    <main className="h-full bg-white flex items-center justify-center p-12 font-sans">
      <div className="w-full max-w-4xl non-draggable">
        <div className="flex flex-col items-center justify-center mb-16">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-black">
              Through
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button className="hover:text-gray-700 transition-colors">
              Business
            </button>
            <span>·</span>
            <button 
              onClick={() => setShowSettings(true)}
              className="hover:text-gray-700 transition-colors"
            >
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

          <ProjectList
            projects={recentProjects}
            onProjectClick={handleProjectClick}
            onProjectContextMenu={handleContextMenu}
          />
        </div>

        {!isElectron && (
          <div className="text-center text-gray-400 text-xs mt-8">
            Please run this app in Electron
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => handleDeleteProject(contextMenu.project)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Project Setup Modal */}
      {selectedProject && (
        <ProjectSetupModal
          projectPath={selectedProject.path}
          projectName={selectedProject.name}
          onClose={() => setSelectedProject(null)}
          onSubmit={handleProjectSetupSubmit}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        api={api}
      />
    </main>
  );
}
