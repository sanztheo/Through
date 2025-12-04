import { ipcMain, BrowserView, BrowserWindow } from "electron";

let previewView: BrowserView | null = null;

export function registerBrowserViewHandlers(mainWindow: BrowserWindow) {
  console.log("Registering BrowserView IPC handlers...");

  // Create and attach BrowserView for preview
  ipcMain.handle(
    "browserview:create",
    async (
      event,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      try {
        console.log("🌐 Creating BrowserView with bounds:", bounds);

        // Remove existing view if any
        if (previewView) {
          mainWindow.removeBrowserView(previewView);
          (previewView.webContents as any).destroy();
          previewView = null;
        }

        // Create new BrowserView
        previewView = new BrowserView({
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            devTools: true,
          },
        });

        mainWindow.addBrowserView(previewView);
        previewView.setBounds(bounds);
        previewView.setAutoResize({
          width: true,
          height: true,
        });

        // Listen for console messages from the browser
        previewView.webContents.on(
          "console-message",
          (event, level, message, line, sourceId) => {
            // level: 0 = log, 1 = warning, 2 = error, 3 = debug, 4 = info
            const logType =
              level === 2
                ? "error"
                : level === 1
                  ? "warning"
                  : level === 3
                    ? "debug"
                    : level === 4
                      ? "info"
                      : "log";

            const logData = {
              message,
              type: logType,
              source: sourceId,
              line,
            };

            console.log("🌐 Browser console:", logData);
            mainWindow.webContents.send("browser:console-log", logData);
          },
        );

        console.log("✅ BrowserView created successfully");
        return { success: true };
      } catch (error: any) {
        console.error("❌ Failed to create BrowserView:", error);
        throw new Error(`Failed to create BrowserView: ${error.message}`);
      }
    },
  );

  // Navigate BrowserView to URL
  ipcMain.handle("browserview:navigate", async (event, url: string) => {
    try {
      if (!previewView) {
        throw new Error("BrowserView not created");
      }

      console.log(`🔗 Navigating BrowserView to ${url}`);
      await previewView.webContents.loadURL(url);
      console.log("✅ Navigation successful");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to navigate:", error);
      throw new Error(`Failed to navigate: ${error.message}`);
    }
  });

  // Update BrowserView bounds
  ipcMain.handle(
    "browserview:set-bounds",
    async (
      event,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      try {
        if (!previewView) {
          throw new Error("BrowserView not created");
        }

        previewView.setBounds(bounds);
        return { success: true };
      } catch (error: any) {
        console.error("❌ Failed to set bounds:", error);
        throw new Error(`Failed to set bounds: ${error.message}`);
      }
    },
  );

  // Open DevTools for BrowserView
  ipcMain.handle("browserview:open-devtools", async () => {
    try {
      if (!previewView) {
        throw new Error("BrowserView not created");
      }

      previewView.webContents.openDevTools();
      console.log("🔍 DevTools opened for BrowserView");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to open DevTools:", error);
      throw new Error(`Failed to open DevTools: ${error.message}`);
    }
  });

  // Close DevTools for BrowserView
  ipcMain.handle("browserview:close-devtools", async () => {
    try {
      if (!previewView) {
        throw new Error("BrowserView not created");
      }

      previewView.webContents.closeDevTools();
      console.log("🔍 DevTools closed for BrowserView");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to close DevTools:", error);
      throw new Error(`Failed to close DevTools: ${error.message}`);
    }
  });

  // Destroy BrowserView
  ipcMain.handle("browserview:destroy", async () => {
    try {
      if (!previewView) {
        return { success: true };
      }

      console.log("🔴 Destroying BrowserView");
      mainWindow.removeBrowserView(previewView);
      (previewView.webContents as any).destroy();
      previewView = null;
      console.log("✅ BrowserView destroyed");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to destroy BrowserView:", error);
      throw new Error(`Failed to destroy BrowserView: ${error.message}`);
    }
  });

  // Reload BrowserView
  ipcMain.handle("browserview:reload", async () => {
    try {
      if (!previewView) {
        throw new Error("BrowserView not created");
      }

      previewView.webContents.reload();
      console.log("🔄 BrowserView reloaded");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to reload:", error);
      throw new Error(`Failed to reload: ${error.message}`);
    }
  });

  // Navigate back in BrowserView
  ipcMain.handle("browserview:go-back", async () => {
    try {
      if (!previewView) {
        throw new Error("BrowserView not created");
      }

      if (previewView.webContents.canGoBack()) {
        previewView.webContents.goBack();
        console.log("⬅️ BrowserView navigated back");
      }
      return { success: true, canGoBack: previewView.webContents.canGoBack() };
    } catch (error: any) {
      console.error("❌ Failed to go back:", error);
      throw new Error(`Failed to go back: ${error.message}`);
    }
  });

  // Navigate forward in BrowserView
  ipcMain.handle("browserview:go-forward", async () => {
    try {
      if (!previewView) {
        throw new Error("BrowserView not created");
      }

      if (previewView.webContents.canGoForward()) {
        previewView.webContents.goForward();
        console.log("➡️ BrowserView navigated forward");
      }
      return {
        success: true,
        canGoForward: previewView.webContents.canGoForward(),
      };
    } catch (error: any) {
      console.error("❌ Failed to go forward:", error);
      throw new Error(`Failed to go forward: ${error.message}`);
    }
  });

  // Check navigation state
  ipcMain.handle("browserview:can-navigate", async () => {
    try {
      if (!previewView) {
        throw new Error("BrowserView not created");
      }

      return {
        success: true,
        canGoBack: previewView.webContents.canGoBack(),
        canGoForward: previewView.webContents.canGoForward(),
      };
    } catch (error: any) {
      console.error("❌ Failed to check navigation state:", error);
      throw new Error(`Failed to check navigation state: ${error.message}`);
    }
  });

  console.log("✅ BrowserView IPC handlers registered");
}
