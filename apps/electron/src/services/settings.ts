import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

export interface AppSettings {
  aiModel: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  aiModel: "gpt-5-mini", // Default to cheapest
};

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export function getSettings(): AppSettings {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error("Error reading settings:", error);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  try {
    const current = getSettings();
    const updated = { ...current, ...settings };
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2));
    console.log("✅ Settings saved:", updated);
    return updated;
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
}

// Model definitions with pricing
export const AI_MODELS = [
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    modelId: "claude-opus-4-5-20251124",
    inputPrice: 5,
    outputPrice: 25,
    description: "Most intelligent, best for complex coding",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5-20250929",
    inputPrice: 3,
    outputPrice: 15,
    description: "Agentic coding, design quality",
  },
  {
    id: "claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251015",
    inputPrice: 1,
    outputPrice: 5,
    description: "Fast and efficient",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    provider: "google",
    modelId: "gemini-3-pro-preview",
    inputPrice: 2,
    outputPrice: 12,
    description: "Reasoning, multi-step tasks",
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    modelId: "gpt-5.1",
    inputPrice: 1.25,
    outputPrice: 10,
    description: "Multimodal, 400k context",
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    modelId: "gpt-5-mini",
    inputPrice: 0.25,
    outputPrice: 2,
    description: "Very cheap, good for simple tasks",
  },
];
