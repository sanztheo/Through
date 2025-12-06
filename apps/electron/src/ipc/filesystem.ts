import { ipcMain } from "electron";
import fs from "fs/promises";
import path from "path";

export function registerFilesystemHandlers() {
  ipcMain.handle("fs:read-file", async (event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return { success: true, content };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "fs:write-file",
    async (event, data: { filePath: string; content: string }) => {
      try {
        await fs.writeFile(data.filePath, data.content, "utf-8");
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("fs:exists", async (event, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("fs:read-dir", async (event, dirPath: string) => {
    try {
      const files = await fs.readdir(dirPath);
      return { success: true, files };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "fs:rename",
    async (event, data: { oldPath: string; newPath: string }) => {
      try {
        await fs.rename(data.oldPath, data.newPath);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("fs:delete", async (event, filePath: string) => {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // List all files recursively in a project
  ipcMain.handle("fs:list-all-files", async (event, projectPath: string) => {
    try {
      const files: string[] = [];
      const ignoreDirs = ["node_modules", ".git", "dist", "build", ".next", ".cache", ".turbo"];
      const ignoreExtensions = [".lock", ".log", ".map"];

      async function walkDir(dir: string, relativePath: string = "") {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.join(relativePath, entry.name);
          
          if (entry.isDirectory()) {
            if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith(".")) {
              await walkDir(fullPath, relPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!ignoreExtensions.includes(ext) && !entry.name.startsWith(".")) {
              files.push(relPath);
            }
          }
        }
      }

      await walkDir(projectPath);
      return { success: true, files };
    } catch (error: any) {
      return { success: false, error: error.message, files: [] };
    }
  });

  console.log("Filesystem IPC handlers registered");
}
