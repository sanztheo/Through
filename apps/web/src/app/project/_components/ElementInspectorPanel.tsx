import React, { useState } from "react";
import { ElementInfo } from "../_hooks/useElementInspector";
import { X, Copy, Check, Sparkles, Loader2, CheckCircle, XCircle } from "lucide-react";

interface AgentResult {
  success: boolean;
  message: string;
  modifiedFile?: string;
  backupFile?: string;
}

interface ElementInspectorPanelProps {
  element: ElementInfo | null;
  projectPath: string | null;
  api: any;
  onClose: () => void;
}

export function ElementInspectorPanel({ 
  element, 
  projectPath,
  api,
  onClose 
}: ElementInspectorPanelProps) {
  const [copiedSelector, setCopiedSelector] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [agentState, setAgentState] = useState<
    "idle" | "loading" | "pending" | "accepted" | "rejected"
  >("idle");
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);

  if (!element) return null;

  const copySelector = async () => {
    try {
      await navigator.clipboard.writeText(element.selector);
      setCopiedSelector(true);
      setTimeout(() => setCopiedSelector(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const handleSubmitToAgent = async () => {
    if (!prompt.trim() || !api?.runCodeAgent || !projectPath) return;

    setAgentState("loading");
    setAgentResult(null);

    try {
      const result = await api.runCodeAgent(element, prompt, projectPath);
      console.log("🤖 Agent result:", result);
      
      setAgentResult(result);
      if (result.success) {
        setAgentState("pending");
      } else {
        setAgentState("idle");
      }
    } catch (error: any) {
      console.error("Agent error:", error);
      setAgentResult({
        success: false,
        message: error.message || "Agent failed",
      });
      setAgentState("idle");
    }
  };

  const handleAccept = async () => {
    if (!agentResult?.backupFile || !api?.acceptAgentChange) return;

    try {
      await api.acceptAgentChange(agentResult.backupFile);
      setAgentState("accepted");
      setPrompt("");
      
      // Reset after a moment
      setTimeout(() => {
        setAgentState("idle");
        setAgentResult(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to accept:", error);
    }
  };

  const handleReject = async () => {
    if (!agentResult?.backupFile || !api?.rejectAgentChange) return;

    try {
      await api.rejectAgentChange(agentResult.backupFile);
      setAgentState("rejected");
      
      // Reset after a moment
      setTimeout(() => {
        setAgentState("idle");
        setAgentResult(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to reject:", error);
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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-gray-900">Element Inspector</span>
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

        {/* Computed Styles (collapsed) */}
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
      </div>

      {/* AI Agent Section */}
      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">AI Modification</span>
        </div>

        {/* Input area */}
        {(agentState === "idle" || agentState === "loading") && (
          <>
            <textarea
              placeholder="Décris ce que tu veux modifier... (ex: 'change la couleur en rouge')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              disabled={agentState === "loading"}
            />
            <button
              onClick={handleSubmitToAgent}
              disabled={agentState === "loading" || !prompt.trim()}
              className="mt-2 w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {agentState === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Apply with AI
                </>
              )}
            </button>
          </>
        )}

        {/* Pending state - waiting for accept/reject */}
        {agentState === "pending" && agentResult && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
                <CheckCircle className="w-4 h-4" />
                Modification appliquée!
              </div>
              <p className="text-xs text-green-600 mt-1">
                {agentResult.message}
              </p>
              {agentResult.modifiedFile && (
                <p className="text-xs text-green-500 mt-1 font-mono">
                  📄 {agentResult.modifiedFile}
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleAccept}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Valider
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Accepted feedback */}
        {agentState === "accepted" && (
          <div className="p-3 bg-green-100 border border-green-300 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
              <CheckCircle className="w-4 h-4" />
              Modification validée!
            </div>
          </div>
        )}

        {/* Rejected feedback */}
        {agentState === "rejected" && (
          <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800 font-medium text-sm">
              <XCircle className="w-4 h-4" />
              Modification annulée, code restauré.
            </div>
          </div>
        )}

        {/* Error display */}
        {agentState === "idle" && agentResult && !agentResult.success && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600">
              ❌ {agentResult.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
