"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, RotateCw } from "lucide-react";

interface ProjectSettingsModalProps {
  isOpen: boolean;
  projectPath: string;
  currentCommands: string[];
  onClose: () => void;
  onSave: (commands: string[]) => void;
}

export function ProjectSettingsModal({
  isOpen,
  projectPath,
  currentCommands,
  onClose,
  onSave,
}: ProjectSettingsModalProps) {
  const [commands, setCommands] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize with current commands
      setCommands(currentCommands.length > 0 ? [...currentCommands] : [""]);
    }
  }, [isOpen, currentCommands]);

  const handleAddCommand = () => {
    setCommands([...commands, ""]);
  };

  const handleRemoveCommand = (index: number) => {
    if (commands.length === 1) return;
    setCommands(commands.filter((_, i) => i !== index));
  };

  const handleCommandChange = (index: number, value: string) => {
    const updated = [...commands];
    updated[index] = value;
    setCommands(updated);
  };

  const handleSave = async () => {
    const validCommands = commands.filter((cmd) => cmd.trim() !== "");
    if (validCommands.length === 0) return;

    setSaving(true);
    try {
      await onSave(validCommands);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const projectName = projectPath.split("/").pop() || "Project";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Project Settings
            </h2>
            <p className="text-xs text-gray-500">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Development Commands
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Ces commandes seront exécutées au démarrage du projet.
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {commands.map((cmd, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cmd}
                  onChange={(e) => handleCommandChange(index, e.target.value)}
                  placeholder="npm run dev"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
                />
                {commands.length > 1 && (
                  <button
                    onClick={() => handleRemoveCommand(index)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    title="Remove command"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleAddCommand}
            className="w-full mt-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add command
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || commands.every((cmd) => cmd.trim() === "")}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save & Restart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
