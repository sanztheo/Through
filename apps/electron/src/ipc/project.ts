import { ipcMain, dialog } from "electron";
import { ProjectAnalyzer } from "../services/ProjectAnalyzer";
import { CacheManager } from "../services/CacheManager";
import { CommandSuggester } from "../services/CommandSuggester";
import { listProjectFiles } from "@through/native";

export function registerProjectHandlers() {
  const analyzer = new ProjectAnalyzer();
  const cache = new CacheManager();
  const commandSuggester = new CommandSuggester();

  ipcMain.handle("project:select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select Project Folder",
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("project:analyze", async (event, projectPath: string) => {
    console.log(`IPC: Analyzing project ${projectPath}`);

    // Check cache first
    const cached = await cache.get(projectPath);
    if (cached && cache.isValid(cached)) {
      console.log("IPC: Returning cached analysis");
      return { ...cached.analysis, fromCache: true };
    }

    // Perform analysis (calls Rust NAPI + OpenAI)
    console.log("IPC: Performing new analysis");
    const analysis = await analyzer.analyze(projectPath);

    // Cache result
    await cache.set(projectPath, analysis);

    return { ...analysis, fromCache: false };
  });

  ipcMain.handle(
    "project:invalidate-cache",
    async (event, projectPath: string) => {
      await cache.invalidate(projectPath);
      return { success: true };
    },
  );

  // New handler: List project files (uses Rust NAPI for speed)
  ipcMain.handle("project:list-files", async (event, projectPath: string) => {
    console.log(`IPC: Listing files for ${projectPath}`);
    try {
      const files = listProjectFiles(projectPath, 3); // max depth 3
      return files;
    } catch (error) {
      console.error("Error listing files:", error);
      throw error;
    }
  });

  // New handler: Suggest commands using LangGraph.js agent
  ipcMain.handle(
    "project:suggest-commands",
    async (event, projectPath: string) => {
      console.log(`IPC: Suggesting commands for ${projectPath}`);
      try {
        const commands = await commandSuggester.suggestCommands(projectPath);
        return commands;
      } catch (error) {
        console.error("Error suggesting commands:", error);
        throw error;
      }
    },
  );

  console.log("Project IPC handlers registered");
}
