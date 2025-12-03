import path from "path";
import { app } from "electron";
import dotenv from "dotenv";

export interface AppConfig {
  OPENAI_API_KEY: string;
  NODE_ENV: "development" | "production";
  CACHE_DIR: string;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
}

let config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (config) return config;

  // Load .env file from project root
  const rootPath = path.join(__dirname, "../../../..");
  const envPath = path.join(rootPath, ".env");
  console.log(`Loading .env from: ${envPath}`);

  dotenv.config({ path: envPath });

  // Validate required environment variables
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  config = {
    OPENAI_API_KEY,
    NODE_ENV: (process.env.NODE_ENV as any) || "production",
    CACHE_DIR:
      process.env.CACHE_DIR || path.join(app.getPath("userData"), "cache"),
    LOG_LEVEL: (process.env.LOG_LEVEL as any) || "info",
  };

  console.log("Configuration loaded successfully");
  return config;
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error("Config not loaded. Call loadConfig() first.");
  }
  return config;
}
