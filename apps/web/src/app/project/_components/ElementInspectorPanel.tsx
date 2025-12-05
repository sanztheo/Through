import React, { useState } from "react";
import { ElementInfo } from "../_hooks/useElementInspector";
import { AgentModification } from "../_hooks/useAgentModifications";
import { PendingModificationsList } from "./PendingModificationsList";
import { X, Copy, Check, Sparkles, Loader2 } from "lucide-react";

interface ElementInspectorPanelProps {
  element: ElementInfo | null;
  modifications: AgentModification[];
  loadingCount: number;
  onRequestModification: (elementInfo: ElementInfo, prompt: string) => Promise<any>;
  onAcceptModification: (id: string) => void;
  onRejectModification: (id: string) => void;
  onDismissModification: (id: string) => void;
  onClose: () => void;
}

export function ElementInspectorPanel({ 
  element,
  modifications,
  loadingCount,
  onRequestModification,
  onAcceptModification,
  onRejectModification,
  onDismissModification,
  onClose,
}: ElementInspectorPanelProps) {
  const [copiedSelector, setCopiedSelector] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show panel if we have element OR pending modifications
  if (!element && modifications.length === 0) return null;

  const copySelector = async () => {
    if (!element) return;
    try {
      await navigator.clipboard.writeText(element.selector);
      setCopiedSelector(true);
      setTimeout(() => setCopiedSelector(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const handleSubmit = async () => {
    if (!element || !prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onRequestModification(element, prompt);
      setPrompt(""); // Clear input after submission
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Format CSS value for display
  const formatCssValue = (value: string) => {
    if (!value || value === "none" || value === "0px" || value === "auto") {
      return <span className="text-gray-400">{value || "none"}</span>;
    }
    return value;
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header with loading indicator */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-gray-900">Element Inspector</span>
          {loadingCount > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 rounded-full">
              <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
              <span className="text-xs text-blue-600 font-medium">{loadingCount}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Element Info - Only shown when element is selected */}
        {element && (
          <>
            {/* Element Tag */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-purple-600 font-mono text-sm">&lt;{element.tagName}</span>
                  {element.id && (
                    <span className="text-blue-600 font-mono text-sm">#{element.id}</span>
                  )}
                  <span className="text-purple-600 font-mono text-sm">&gt;</span>
                </div>
              </div>
              {element.className && typeof element.className === 'string' && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {element.className.split(/\s+/).filter(Boolean).slice(0, 5).map((cls, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-600"
                    >
                      .{cls}
                    </span>
                  ))}
                  {element.className.split(/\s+/).filter(Boolean).length > 5 && (
                    <span className="px-1.5 py-0.5 text-xs text-gray-400">
                      +{element.className.split(/\s+/).filter(Boolean).length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Selector */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Selector</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 truncate">
                  {element.selector}
                </code>
                <button
                  onClick={copySelector}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                  title="Copy selector"
                >
                  {copiedSelector ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Dimensions */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="text-xs text-gray-500 mb-2">Dimensions</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Width:</span>
                  <span className="ml-1 font-mono text-gray-900">
                    {Math.round(element.rect.width)}px
                  </span>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Height:</span>
                  <span className="ml-1 font-mono text-gray-900">
                    {Math.round(element.rect.height)}px
                  </span>
                </div>
              </div>
            </div>

            {/* Key Styles */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="text-xs text-gray-500 mb-2">Key Styles</div>
              <div className="space-y-1">
                {Object.entries(element.computedStyle).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="flex items-center text-xs">
                    <span className="text-purple-600 font-mono w-24 truncate">{key}:</span>
                    <span className="font-mono text-gray-700 truncate flex-1">
                      {formatCssValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* No element selected message */}
        {!element && modifications.length > 0 && (
          <div className="px-3 py-4 text-center text-gray-500 text-sm">
            Sélectionne un élément pour faire une nouvelle modification
          </div>
        )}

        {/* Pending Modifications */}
        {modifications.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Modifications ({modifications.length})</div>
            <PendingModificationsList
              modifications={modifications}
              onAccept={onAcceptModification}
              onReject={onRejectModification}
              onDismiss={onDismissModification}
            />
          </div>
        )}
      </div>

      {/* AI Input Section - Only visible when element selected */}
      {element && (
        <div className="border-t border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">AI Modification</span>
          </div>

          <textarea
            placeholder="Décris ce que tu veux modifier... (ex: 'change la couleur en rouge')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isSubmitting}
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !prompt.trim()}
            className="mt-2 w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Appliquer
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 mt-1 text-center">
            Entrée pour envoyer • Tu peux continuer à inspecter
          </p>
        </div>
      )}
    </div>
  );
}
