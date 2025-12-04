"use client";

import { useState } from "react";
import { X, Sparkles, Plus } from "lucide-react";
import { FileExplorer } from "./FileExplorer";

interface ProjectSetupModalProps {
  projectPath: string;
  projectName: string;
  onClose: () => void;
  onSubmit: (commands: string[]) => void;
}

export function ProjectSetupModal({
  projectPath,
  projectName,
  onClose,
  onSubmit,
}: ProjectSetupModalProps) {
  const [commands, setCommands] = useState<string[]>([""]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const handleAddCommand = () => {
    setCommands([...commands, ""]);
  };

  const handleCommandChange = (index: number, value: string) => {
    const updated = [...commands];
    updated[index] = value;
    setCommands(updated);
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
            <button
              onClick={handleAISuggest}
              disabled={isLoadingAI}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-[#4DAFE3]"
              style={{
                background: "linear-gradient(135deg, #258BFF 0%, #72B4FF 100%)",
              }}
            >
              <Sparkles className="w-4 h-4" />
              {isLoadingAI ? "Analyzing..." : "AI Suggest"}
            </button>
          </div>

          {/* Command Inputs */}
          <div className="space-y-2">
            {commands.map((cmd, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cmd}
                  onChange={(e) => handleCommandChange(index, e.target.value)}
                  placeholder="npm run dev"
                  className="flex-1 px-4 py-2.5 border border-[#ECECEC] rounded-lg text-sm font-['Geist'] font-medium placeholder:text-black/20 focus:outline-none focus:border-[#4DAFE3] transition-colors"
                />
                {commands.length > 1 && (
                  <button
                    onClick={() => handleRemoveCommand(index)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
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
