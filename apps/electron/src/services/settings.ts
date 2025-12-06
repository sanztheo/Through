import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

export interface AppSettings {
  aiModel: string;
  defaultClonePath: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  aiModel: "gpt-5-mini", // Default to cheapest
  defaultClonePath: "", // Empty = ask each time
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

// Model definitions with pricing (using ACTUAL API model IDs)
export const AI_MODELS = [
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    modelId: "claude-opus-4-5-20251101",
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
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    inputPrice: 3,
    outputPrice: 15,
    description: "Fast, great for coding",
  },
  {
    id: "claude-3-5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    modelId: "claude-3-5-haiku-latest",
    inputPrice: 0.25,
    outputPrice: 1.25,
    description: "Fast and cheap",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    modelId: "gemini-2.0-flash",
    inputPrice: 0.1,
    outputPrice: 0.4,
    description: "Fast, multimodal",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    modelId: "gpt-4o",
    inputPrice: 2.5,
    outputPrice: 10,
    description: "Multimodal, fast",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    inputPrice: 0.15,
    outputPrice: 0.6,
    description: "Very cheap, good for simple tasks",
  },
  {
    id: "o4-mini",
    name: "OpenAI o4-mini",
    provider: "openai",
    modelId: "o4-mini",
    inputPrice: 1.1,
    outputPrice: 4.4,
    description: "🧠 Reasoning model, good for complex tasks",
  },
  {
    id: "o3",
    name: "OpenAI o3",
    provider: "openai",
    modelId: "o3",
    inputPrice: 10,
    outputPrice: 40,
    description: "🧠 Most powerful reasoning, expensive",
  },
  {
    id: "o3-mini",
    name: "OpenAI o3-mini",
    provider: "openai",
    modelId: "o3-mini",
    inputPrice: 1.1,
    outputPrice: 4.4,
    description: "🧠 Fast reasoning, cheaper than o3",
  },
  {
    id: "o1",
    name: "OpenAI o1",
    provider: "openai",
    modelId: "o1",
    inputPrice: 15,
    outputPrice: 60,
    description: "🧠 Advanced reasoning",
  },
  {
    id: "o1-mini",
    name: "OpenAI o1-mini",
    provider: "openai",
    modelId: "o1-mini",
    inputPrice: 1.1,
    outputPrice: 4.4,
    description: "🧠 Fast reasoning, affordable",
  },
];

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

export function getModel() {
  const settings = getSettings();
  const modelDef = AI_MODELS.find((m) => m.id === settings.aiModel);
  
  if (!modelDef) {
    // Fallback
    console.warn("Model not found, using fallback:", settings.aiModel);
    return openai("gpt-4o-mini");
  }

  // Handle specific model ID formats if necessary
  // Vercel SDK generic providers usually take the model ID string directly
  switch (modelDef.provider) {
    case "anthropic":
      return anthropic(modelDef.modelId);
    case "openai":
      return openai(modelDef.modelId);
    case "google":
      return google(modelDef.modelId);
    default:
      return openai("gpt-4o-mini");
  }
}
