"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { FileExplorer } from "./FileExplorer";

interface ProjectSetupModalProps {
  projectPath: string;
  projectName: string;
  onClose: () => void;
  onSubmit: (commands: string[]) => void;
}

interface ValidationResult {
  valid: boolean;
  corrected: string;
  issues: string[];
}

export function ProjectSetupModal({
  projectPath,
  projectName,
  onClose,
  onSubmit,
}: ProjectSetupModalProps) {
  const [commands, setCommands] = useState<string[]>([""]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [validationResults, setValidationResults] = useState<
    Map<number, ValidationResult>
  >(new Map());
  const validationTimeoutRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const handleAddCommand = () => {
    setCommands([...commands, ""]);
  };

  const handleCommandChange = (index: number, value: string) => {
    // Update command immediately (no blocking)
    const updated = [...commands];
    updated[index] = value;
    setCommands(updated);

    // Clear previous validation timeout for this input
    const existingTimeout = validationTimeoutRef.current.get(index);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Clear validation result while typing
    setValidationResults((prev) => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });

    // Debounce validation (wait 800ms after user stops typing)
    if (value.trim() && typeof window !== "undefined" && window.electronAPI) {
      const timeout = setTimeout(async () => {
        try {
          const result = await window.electronAPI.validateCommand(
            projectPath,
            value,
          );
          console.log(`[Modal] Validation result for "${value}":`, result);

          // Auto-apply correction if command has issues
          if (!result.valid && result.corrected !== value) {
            console.log(`[Modal] Auto-correcting to: "${result.corrected}"`);
            setCommands((prevCommands) => {
              const newCommands = [...prevCommands];
              newCommands[index] = result.corrected;
              return newCommands;
            });
          }

          // Store validation result
          setValidationResults((prev) => {
            const newMap = new Map(prev);
            newMap.set(index, result);
            return newMap;
          });
        } catch (error) {
          console.error("[Modal] Validation error:", error);
        }
      }, 800);

      validationTimeoutRef.current.set(index, timeout);
    }
  };

  const handleRemoveCommand = (index: number) => {
    if (commands.length === 1) return;
    const updated = commands.filter((_, i) => i !== index);
    setCommands(updated);
  };

  const handleAISuggest = async () => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    setIsLoadingAI(true);
    try {
      console.log("[Modal] Requesting AI suggestions for:", projectPath);
      const suggestions = await window.electronAPI.suggestCommands(projectPath);
      console.log("[Modal] Received suggestions:", suggestions);

      if (suggestions && suggestions.length > 0) {
        console.log("[Modal] Setting commands to:", suggestions);
        setCommands(suggestions);
      } else {
        console.warn("[Modal] No suggestions received");
      }
    } catch (error) {
      console.error("[Modal] Failed to get AI suggestions:", error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleSubmit = () => {
    const validCommands = commands.filter((cmd) => cmd.trim() !== "");
    if (validCommands.length === 0) return;
    onSubmit(validCommands);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 non-draggable">
      <div className="bg-white rounded-2xl shadow-2xl w-[800px] h-[600px] flex flex-col overflow-hidden border border-[#ECECEC]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECECEC]">
          <div>
            <h2 className="text-lg font-semibold text-black">{projectName}</h2>
            <p className="text-xs text-black/40 font-['Geist'] font-medium">
              {projectPath}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* File Explorer Section */}
        <div className="flex-1 overflow-y-auto border-b border-[#ECECEC]">
          <FileExplorer projectPath={projectPath} />
        </div>

        {/* Command Input Section */}
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-black/60 font-['Geist']">
              Development commands
            </span>
          </div>

          {/* Command Inputs */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {commands.map((cmd, index) => {
              const validation = validationResults.get(index);
              const hasIssues =
                validation &&
                (!validation.valid || validation.issues.length > 0);
              const isValid = validation && validation.valid;

              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) =>
                          handleCommandChange(index, e.target.value)
                        }
                        placeholder="npm run dev"
                        className={`w-full px-4 py-2.5 pr-28 border rounded-lg text-sm text-black font-['Geist'] font-medium placeholder:text-black/20 focus:outline-none transition-colors ${
                          hasIssues
                            ? "border-orange-400 focus:border-orange-500"
                            : isValid
                              ? "border-green-400 focus:border-green-500"
                              : "border-[#ECECEC] focus:border-[#4DAFE3]"
                        }`}
                      />
                      <button
                        onClick={handleAISuggest}
                        disabled={isLoadingAI}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-[#4DAFE3]"
                        style={{
                          background:
                            "linear-gradient(135deg, #258BFF 0%, #72B4FF 100%)",
                        }}
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                    {commands.length > 1 && (
                      <button
                        onClick={() => handleRemoveCommand(index)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Validation Feedback */}
                  {validation && validation.issues.length > 0 && (
                    <div className="flex items-start gap-2 px-2">
                      {validation.valid ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        {validation.issues.map((issue, i) => (
                          <p
                            key={i}
                            className={`text-xs font-['Geist'] ${
                              validation.valid
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}
                          >
                            {issue}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Command Button */}
          <button
            onClick={handleAddCommand}
            className="w-full py-2.5 border border-dashed border-[#ECECEC] rounded-lg text-sm font-['Geist'] font-medium text-black/60 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add other command
          </button>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={commands.every((cmd) => cmd.trim() === "")}
            className="w-full py-3 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Development
          </button>
        </div>
      </div>
    </div>
  );
}
