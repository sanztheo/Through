import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getConfig } from "../utils/config";
import type { ProjectAnalysis, CacheEntry } from "@through/shared";

export class CacheManager {
  private cacheDir: string;

  constructor() {
    const config = getConfig();
    this.cacheDir = path.join(config.CACHE_DIR, "projects");
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  private hashProjectPath(projectPath: string): string {
    return crypto
      .createHash("sha256")
      .update(projectPath)
      .digest("hex")
      .substring(0, 16);
  }

  private getCachePath(projectPath: string): string {
    const hash = this.hashProjectPath(projectPath);
    return path.join(this.cacheDir, `${hash}.json`);
  }

  async get(projectPath: string): Promise<CacheEntry | null> {
    const cachePath = this.getCachePath(projectPath);

    try {
      const content = await fs.readFile(cachePath, "utf-8");
      const entry = JSON.parse(content);
      console.log(`Cache hit for ${projectPath}`);
      return entry;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.log(`Cache miss for ${projectPath}`);
        return null;
      }
      console.error("Cache read error:", error);
      return null;
    }
  }

  async set(
    projectPath: string,
    analysis: ProjectAnalysis,
    commands?: string[],
  ): Promise<void> {
    const cachePath = this.getCachePath(projectPath);
    const entry: CacheEntry = {
      analysis,
      cachedAt: new Date().toISOString(),
      projectHash: this.hashProjectPath(projectPath),
      commands,
    };

    await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), "utf-8");
    console.log(`Cached analysis for ${projectPath}`);
  }

  async updateCommands(projectPath: string, commands: string[]): Promise<void> {
    const cachePath = this.getCachePath(projectPath);

    try {
      const existing = await this.get(projectPath);
      if (existing) {
        existing.commands = commands;
        await fs.writeFile(
          cachePath,
          JSON.stringify(existing, null, 2),
          "utf-8",
        );
        console.log(`Updated commands for ${projectPath}`);
      } else {
        console.warn(
          `No cache entry found for ${projectPath}, cannot update commands`,
        );
      }
    } catch (error) {
      console.error("Error updating commands:", error);
      throw error;
    }
  }

  isValid(entry: CacheEntry, maxAgeHours: number = 24): boolean {
    const cachedTime = new Date(entry.cachedAt).getTime();
    const now = Date.now();
    const ageHours = (now - cachedTime) / (1000 * 60 * 60);

    const valid = ageHours < maxAgeHours;
    console.log(`Cache age: ${ageHours.toFixed(2)} hours, valid: ${valid}`);
    return valid;
  }

  async invalidate(projectPath: string): Promise<void> {
    const cachePath = this.getCachePath(projectPath);

    try {
      await fs.unlink(cachePath);
      console.log(`Invalidated cache for ${projectPath}`);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.error("Cache invalidation error:", error);
      }
    }
  }

  async clear(): Promise<void> {
    const files = await fs.readdir(this.cacheDir);
    await Promise.all(
      files.map((file) => fs.unlink(path.join(this.cacheDir, file))),
    );
    console.log("Cache cleared");
  }
}
