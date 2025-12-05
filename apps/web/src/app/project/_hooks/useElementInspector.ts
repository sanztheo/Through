import { useState, useEffect, useCallback } from "react";

export interface ElementInfo {
  tagName: string;
  id: string | null;
  className: string | null;
  selector: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
  computedStyle: Record<string, string>;
  attributes: Array<{ name: string; value: string }>;
  textContent: string | null;
  childCount: number;
  parentTag: string | null;
}

interface UseElementInspectorProps {
  api: any;
}

export function useElementInspector({ api }: UseElementInspectorProps) {
  const [isInspecting, setIsInspecting] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);

  // Listen for element selection from inspector
  useEffect(() => {
    if (!api?.onElementSelected) return;

    api.onElementSelected((elementInfo: ElementInfo) => {
      console.log("🎯 Element selected:", elementInfo);
      setSelectedElement(elementInfo);
      // Automatically disable inspector after selection
      setIsInspecting(false);
      if (api?.toggleInspector) {
        api.toggleInspector(false);
      }
    });
  }, [api]);

  // Listen for inspector cancellation (Escape key)
  useEffect(() => {
    if (!api?.onInspectorCancelled) return;

    api.onInspectorCancelled(() => {
      console.log("🚫 Inspector cancelled");
      setIsInspecting(false);
    });
  }, [api]);

  // Toggle inspector mode
  const toggleInspector = useCallback(async () => {
    if (!api?.toggleInspector) return;

    const newState = !isInspecting;
    try {
      await api.toggleInspector(newState);
      setIsInspecting(newState);
      
      // Clear selection when starting a new inspection
      if (newState) {
        setSelectedElement(null);
      }
    } catch (error) {
      console.error("Failed to toggle inspector:", error);
    }
  }, [api, isInspecting]);

  // Clear the selected element
  const clearSelection = useCallback(() => {
    setSelectedElement(null);
  }, []);

  return {
    isInspecting,
    selectedElement,
    toggleInspector,
    clearSelection,
  };
}
