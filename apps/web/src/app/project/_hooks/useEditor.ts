import { useState, useRef, useCallback, useEffect } from "react";
import { EditorTab } from "@/components/editor";

interface UseEditorProps {
  api: any;
}

export function useEditor({ api }: UseEditorProps) {
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
  const [activeEditorTabId, setActiveEditorTabId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"browser" | "editor">("browser");

  const contentMapRef = useRef<Map<string, string>>(new Map());
  const editorTabsRef = useRef(editorTabs);

  // Sync editorTabsRef
  useEffect(() => {
    editorTabsRef.current = editorTabs;
  }, [editorTabs]);

  // Open file in editor
  const handleFileOpen = useCallback(
    async (filePath: string, filename: string) => {
      if (!api) return;

      const existingTab = editorTabs.find((t) => t.path === filePath);
      if (existingTab) {
        setActiveEditorTabId(existingTab.id);
        setViewMode("editor");
        return;
      }

      try {
        const result = await api.readFile(filePath);
        if (result.success && result.content !== undefined) {
          const newTab: EditorTab = {
            id: `editor_${Date.now()}`,
            filename,
            path: filePath,
            content: result.content,
            originalContent: result.content,
            isModified: false,
          };

          contentMapRef.current.set(newTab.id, result.content);

          setEditorTabs((prev) => [...prev, newTab]);
          setActiveEditorTabId(newTab.id);
          setViewMode("editor");
        } else {
          console.error("Failed to read file:", result.error);
        }
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [api, editorTabs]
  );

  // Handle editor content change
  const handleEditorContentChange = useCallback(
    (tabId: string, content: string) => {
      contentMapRef.current.set(tabId, content);

      setEditorTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                content,
                isModified: content !== tab.originalContent,
              }
            : tab
        )
      );
    },
    []
  );

  // Close editor tab
  const handleEditorTabClose = useCallback(
    (tabId: string) => {
      const tab = editorTabs.find((t) => t.id === tabId);
      const currentContent = contentMapRef.current.get(tabId);
      const isModified =
        currentContent !== undefined && tab
          ? currentContent !== tab.originalContent
          : tab?.isModified;

      if (isModified) {
        const confirm = window.confirm(
          `${tab?.filename} has unsaved changes. Close anyway?`
        );
        if (!confirm) return;
      }

      contentMapRef.current.delete(tabId);

      setEditorTabs((prev) => prev.filter((t) => t.id !== tabId));

      if (activeEditorTabId === tabId) {
        const remaining = editorTabs.filter((t) => t.id !== tabId);
        if (remaining.length > 0) {
          setActiveEditorTabId(remaining[remaining.length - 1].id);
        } else {
          setActiveEditorTabId(null);
          setViewMode("browser");
        }
      }
    },
    [editorTabs, activeEditorTabId]
  );

  // Save file
  const handleEditorSave = useCallback(
    async (tabId: string) => {
      console.log("💾 Saving tab:", tabId);
      if (!api) {
        console.error("❌ API not available");
        return;
      }

      const tab = editorTabsRef.current.find((t) => t.id === tabId);

      if (!tab) {
        console.error("❌ Tab not found:", tabId);
        return;
      }

      const contentToSave = contentMapRef.current.get(tabId);

      if (contentToSave === undefined) {
        console.error("❌ Content not found in ref for tab:", tabId);
        return;
      }

      console.log("📝 Writing file:", tab.path);
      try {
        const result = await api.writeFile(tab.path, contentToSave);
        console.log("📝 Write result:", result);

        if (result.success) {
          setEditorTabs((prev) =>
            prev.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    content: contentToSave,
                    originalContent: contentToSave,
                    isModified: false,
                  }
                : t
            )
          );
          console.log(`✅ Saved ${tab.filename}`);
        } else {
          console.error("❌ Failed to save file:", result.error);
        }
      } catch (err) {
        console.error("❌ Exception saving file:", err);
      }
    },
    [api]
  );

  return {
    editorTabs,
    activeEditorTabId,
    viewMode,
    setViewMode,
    setActiveEditorTabId,
    handleFileOpen,
    handleEditorContentChange,
    handleEditorTabClose,
    handleEditorSave,
  };
}
