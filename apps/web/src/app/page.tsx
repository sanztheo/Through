"use client";

import { useState } from "react";
import { useElectronAPI } from "@/hooks/useElectronAPI";

export default function HomePage() {
  const { isElectron, api } = useElectronAPI();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenProject = async () => {
    if (!api) return;

    try {
      setIsLoading(true);
      setError(null);
      const folderPath = await api.selectFolder();

      if (folderPath) {
        console.log("Selected folder:", folderPath);
        // TODO: Analyze the project
        const analysis = await api.analyzeProject(folderPath);
        console.log("Analysis result:", analysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select folder");
      console.error("Error selecting folder:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 bg-[#1e293b]">
      <div className="w-full max-w-4xl mt-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">Through</h1>
          <p className="text-xl text-gray-400">
            Analyze and launch your development projects
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <button
            onClick={handleOpenProject}
            disabled={!isElectron || isLoading}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg p-6 text-left transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="text-gray-400 group-hover:text-white transition-colors">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">
                  Open project
                </h3>
              </div>
            </div>
          </button>

          <button
            disabled
            className="bg-gray-800 cursor-not-allowed rounded-lg p-6 text-left opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="text-gray-500">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-gray-500 font-semibold text-lg">
                  Clone repo
                </h3>
                <p className="text-xs text-gray-600 mt-1">Coming soon</p>
              </div>
            </div>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <p className="text-gray-300">Analyzing project...</p>
          </div>
        )}

        {/* Recent Projects Section */}
        <div className="mt-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-gray-400 text-sm font-medium">
              Recent projects
            </h2>
            <button className="text-gray-500 text-sm hover:text-gray-400">
              View all (0)
            </button>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-8 text-center">
            <p className="text-gray-500">No recent projects yet</p>
            <p className="text-gray-600 text-sm mt-2">
              Open a project to get started
            </p>
          </div>
        </div>
      </div>

      {!isElectron && (
        <div className="text-center text-gray-500 text-sm">
          Please run this app in Electron
        </div>
      )}
    </main>
  );
}
