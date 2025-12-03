import { ipcMain, BrowserWindow } from "electron";

export function registerWindowHandlers(mainWindow: BrowserWindow) {
  console.log("Registering Window IPC handlers...");

  // Close window
  ipcMain.handle("window:close", () => {
    mainWindow.close();
  });

  // Minimize window
  ipcMain.handle("window:minimize", () => {
    mainWindow.minimize();
  });

  // Maximize/Restore window
  ipcMain.handle("window:maximize", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  });

  // Check if maximized
  ipcMain.handle("window:is-maximized", () => {
    return mainWindow.isMaximized();
  });

  console.log("✅ Window IPC handlers registered");
}
