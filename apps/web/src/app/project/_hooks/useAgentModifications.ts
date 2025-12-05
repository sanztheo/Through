import { useState, useCallback, useRef } from "react";
import { ElementInfo } from "./useElementInspector";

export interface AgentModification {
  id: string;
  elementInfo: ElementInfo;
  prompt: string;
  status: "loading" | "pending" | "accepted" | "rejected" | "error";
  result?: {
    success: boolean;
    message: string;
    modifiedFile?: string;
    backupFile?: string;
  };
  createdAt: Date;
  isPreviewingOriginal?: boolean;
}

export function useAgentModifications(api: any, projectPath: string | null) {
  const [modifications, setModifications] = useState<AgentModification[]>([]);
  const idCounter = useRef(0);

  // Add a new modification request
  const requestModification = useCallback(
    async (elementInfo: ElementInfo, prompt: string) => {
      if (!api?.runCodeAgent || !projectPath) {
        console.error("API or projectPath not available");
        return null;
      }

      const id = `mod-${Date.now()}-${idCounter.current++}`;
      
      const newMod: AgentModification = {
        id,
        elementInfo,
        prompt,
        status: "loading",
        createdAt: new Date(),
        isPreviewingOriginal: false,
      };

      // Add to list
      setModifications((prev) => [newMod, ...prev]);

      try {
        console.log(`🤖 Starting modification ${id}: "${prompt}"`);
        const result = await api.runCodeAgent(elementInfo, prompt, projectPath);
        
        console.log(`🤖 Modification ${id} result:`, result);

        // Update status based on result
        setModifications((prev) =>
          prev.map((mod) =>
            mod.id === id
              ? {
                  ...mod,
                  status: result.success ? "pending" : "error",
                  result,
                }
              : mod
          )
        );

        return result;
      } catch (error: any) {
        console.error(`❌ Modification ${id} failed:`, error);
        
        setModifications((prev) =>
          prev.map((mod) =>
            mod.id === id
              ? {
                  ...mod,
                  status: "error",
                  result: {
                    success: false,
                    message: error.message || "Failed to run agent",
                  },
                }
              : mod
          )
        );

        return null;
      }
    },
    [api, projectPath]
  );

  // Accept a modification
  const acceptModification = useCallback(
    async (id: string) => {
      const mod = modifications.find((m) => m.id === id);
      if (!mod || !mod.result?.backupFile || !api?.acceptAgentChange) {
        return false;
      }

      // If we're previewing original, swap back to modified first
      if (mod.isPreviewingOriginal) {
        await api.previewModified(mod.result.backupFile);
      }

      try {
        await api.acceptAgentChange(mod.result.backupFile);
        
        setModifications((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, status: "accepted" } : m
          )
        );

        // Remove after delay
        setTimeout(() => {
          setModifications((prev) => prev.filter((m) => m.id !== id));
        }, 2000);

        return true;
      } catch (error) {
        console.error("Failed to accept modification:", error);
        return false;
      }
    },
    [modifications, api]
  );

  // Reject a modification
  const rejectModification = useCallback(
    async (id: string) => {
      const mod = modifications.find((m) => m.id === id);
      if (!mod || !mod.result?.backupFile || !api?.rejectAgentChange) {
        return false;
      }

      // If we're previewing original, swap back to modified first before rejecting
      if (mod.isPreviewingOriginal) {
        await api.previewModified(mod.result.backupFile);
      }

      try {
        await api.rejectAgentChange(mod.result.backupFile);
        
        setModifications((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, status: "rejected" } : m
          )
        );

        // Remove after delay
        setTimeout(() => {
          setModifications((prev) => prev.filter((m) => m.id !== id));
        }, 2000);

        return true;
      } catch (error) {
        console.error("Failed to reject modification:", error);
        return false;
      }
    },
    [modifications, api]
  );

  // Toggle between original and modified preview
  const togglePreview = useCallback(
    async (id: string) => {
      const mod = modifications.find((m) => m.id === id);
      if (!mod || !mod.result?.backupFile) {
        return false;
      }

      try {
        if (mod.isPreviewingOriginal) {
          // Currently showing original, switch to modified
          await api.previewModified(mod.result.backupFile);
        } else {
          // Currently showing modified, switch to original
          await api.previewOriginal(mod.result.backupFile);
        }

        setModifications((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, isPreviewingOriginal: !m.isPreviewingOriginal } : m
          )
        );

        return true;
      } catch (error) {
        console.error("Failed to toggle preview:", error);
        return false;
      }
    },
    [modifications, api]
  );

  // Dismiss an error notification
  const dismissModification = useCallback((id: string) => {
    setModifications((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Get counts for UI indicators
  const loadingCount = modifications.filter((m) => m.status === "loading").length;
  const pendingCount = modifications.filter((m) => m.status === "pending").length;

  return {
    modifications,
    requestModification,
    acceptModification,
    rejectModification,
    togglePreview,
    dismissModification,
    loadingCount,
    pendingCount,
    hasActiveModifications: loadingCount > 0 || pendingCount > 0,
  };
}

