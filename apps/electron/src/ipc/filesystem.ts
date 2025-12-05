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

  console.log("Filesystem IPC handlers registered");
}
