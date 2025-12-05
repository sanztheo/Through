"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Check } from "lucide-react";

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  inputPrice: number;
  outputPrice: number;
  description: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  api: any;
}

export function SettingsModal({ isOpen, onClose, api }: SettingsModalProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && api?.getSettings) {
      loadSettings();
    }
  }, [isOpen, api]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await api.getSettings();
      setModels(result.models);
      setSelectedModel(result.settings.aiModel);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!api?.setSettings) return;
    
    try {
      setSaving(true);
      await api.setSettings({ aiModel: selectedModel });
      onClose();
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case "anthropic":
        return "bg-orange-100 text-orange-700";
      case "google":
        return "bg-blue-100 text-blue-700";
      case "openai":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">AI Settings</h2>
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
            Select AI Model
          </h3>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    selectedModel === model.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {model.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getProviderColor(
                          model.provider
                        )}`}
                      >
                        {model.provider}
                      </span>
                    </div>
                    {selectedModel === model.id && (
                      <Check className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-2">
                    {model.description}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>
                      Input: <span className="text-gray-600">${model.inputPrice}/M</span>
                    </span>
                    <span>
                      Output: <span className="text-gray-600">${model.outputPrice}/M</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
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
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
