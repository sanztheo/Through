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

  console.log("✅ BrowserView IPC handlers registered");
}
