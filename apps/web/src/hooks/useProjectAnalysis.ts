import { useState } from "react";
import { useElectronAPI } from "./useElectronAPI";
import type { ProjectAnalysis } from "@through/shared";

export function useProjectAnalysis() {
  const { api } = useElectronAPI();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectAndAnalyze = async () => {
    if (!api) {
      setError("Electron API not available");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const folderPath = await api.selectFolder();
      if (!folderPath) {
        setIsAnalyzing(false);
        return;
      }

      const result = await api.analyzeProject(folderPath);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || "Failed to analyze project");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const invalidateCache = async () => {
    if (!api || !analysis) return;

    try {
      await api.invalidateCache(analysis.projectPath);
      setAnalysis(null);
    } catch (err: any) {
      setError(err.message || "Failed to invalidate cache");
    }
  };

  return {
    analysis,
    isAnalyzing,
    error,
    selectAndAnalyze,
    invalidateCache,
  };
}
