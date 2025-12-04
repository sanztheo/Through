import { ipcMain, BrowserView, BrowserWindow } from "electron";

interface BrowserTab {
  id: string;
  view: BrowserView;
  title: string;
  url: string;
}

let browserTabs: Map<string, BrowserTab> = new Map();
let activeTabId: string | null = null;
let lastBounds: { x: number; y: number; width: number; height: number } | null = null;

function generateTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function registerBrowserViewHandlers(mainWindow: BrowserWindow) {
  console.log("Registering BrowserView IPC handlers...");

  // Create a new tab
  ipcMain.handle(
    "browserview:create-tab",
    async (
      event,
      bounds: { x: number; y: number; width: number; height: number },
      url?: string,
    ) => {
      try {
        const tabId = generateTabId();
        console.log(`🌐 Creating new tab ${tabId} with bounds:`, bounds);

        // Create new BrowserView with unique partition for session isolation
        // Each tab has its own cookies, localStorage, etc.
        const view = new BrowserView({
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            devTools: true,
            partition: `persist:tab_${tabId}`, // Unique session per tab
          },
        });

        console.log(`🔒 Created isolated session: persist:tab_${tabId}`);

        // Listen for title updates
        view.webContents.on("page-title-updated", (event, title) => {
          const tab = browserTabs.get(tabId);
          if (tab) {
            tab.title = title;
            browserTabs.set(tabId, tab);
            mainWindow.webContents.send("browserview:tab-updated", {
              id: tabId,
              title,
              url: tab.url,
            });
          }
        });

        // Listen for navigation
        view.webContents.on("did-navigate", (event, url) => {
          const tab = browserTabs.get(tabId);
          if (tab) {
            tab.url = url;
            browserTabs.set(tabId, tab);
            mainWindow.webContents.send("browserview:tab-updated", {
              id: tabId,
              title: tab.title,
              url,
            });
          }
        });

        // Listen for new windows (popups like Google OAuth)
        view.webContents.setWindowOpenHandler((details) => {
          console.log("🪟 New window requested:", details.url);
          // Create a new tab for the popup
          mainWindow.webContents
            .executeJavaScript(
              `window.electronAPI.createTab({ url: "${details.url}" })`,
            )
            .catch(console.error);
          return { action: "deny" }; // Prevent default window
        });

        // Listen for console messages
        view.webContents.on(
          "console-message",
          (event, level, message, line, sourceId) => {
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

            mainWindow.webContents.send("browser:console-log", {
              message,
              type: logType,
              source: sourceId,
              line,
              tabId,
            });
          },
        );

        const tab: BrowserTab = {
          id: tabId,
          view,
          title: url || "New Tab",
          url: url || "",
        };

        browserTabs.set(tabId, tab);

        // Store bounds for later use (e.g., when switching tabs)
        lastBounds = bounds;

        // If this is the first tab, make it active
        // Otherwise, switch to the new tab
        if (!activeTabId || browserTabs.size === 1) {
          mainWindow.addBrowserView(view);
          view.setBounds(bounds);
          view.setAutoResize({ width: true, height: true });
          activeTabId = tabId;
        } else {
          // Switch to new tab - remove current active, add new one
          const currentTab = browserTabs.get(activeTabId);
          if (currentTab) {
            mainWindow.removeBrowserView(currentTab.view);
          }
          mainWindow.addBrowserView(view);
          view.setBounds(bounds);
          view.setAutoResize({ width: true, height: true });
          activeTabId = tabId;
        }

        // Load URL if provided
        if (url) {
          await view.webContents.loadURL(url);
        }

        console.log(`✅ Tab ${tabId} created successfully`);
        return {
          success: true,
          tabId,
          title: tab.title,
          url: tab.url,
        };
      } catch (error: any) {
        console.error("❌ Failed to create tab:", error);
        throw new Error(`Failed to create tab: ${error.message}`);
      }
    },
  );

  // Switch to a different tab
  ipcMain.handle(
    "browserview:switch-tab",
    async (
      event,
      tabId: string,
      bounds?: { x: number; y: number; width: number; height: number },
    ) => {
      try {
        const tab = browserTabs.get(tabId);
        if (!tab) {
          throw new Error(`Tab ${tabId} not found`);
        }

        // Remove current active tab view
        if (activeTabId) {
          const currentTab = browserTabs.get(activeTabId);
          if (currentTab) {
            mainWindow.removeBrowserView(currentTab.view);
          }
        }

        // Add the new tab view
        mainWindow.addBrowserView(tab.view);

        // Use provided bounds, or fallback to stored lastBounds
        const finalBounds = bounds || lastBounds;
        if (finalBounds) {
          tab.view.setBounds(finalBounds);
          lastBounds = finalBounds; // Update stored bounds
        }
        tab.view.setAutoResize({ width: true, height: true });

        activeTabId = tabId;
        console.log(`🔀 Switched to tab ${tabId}`);

        return { success: true };
      } catch (error: any) {
        console.error("❌ Failed to switch tab:", error);
        throw new Error(`Failed to switch tab: ${error.message}`);
      }
    },
  );

  // Close a tab
  ipcMain.handle("browserview:close-tab", async (event, tabId: string) => {
    try {
      const tab = browserTabs.get(tabId);
      if (!tab) {
        throw new Error(`Tab ${tabId} not found`);
      }

      // If this is the active tab, switch to another tab first
      if (activeTabId === tabId) {
        mainWindow.removeBrowserView(tab.view);

        // Find another tab to activate
        const remainingTabs = Array.from(browserTabs.entries()).filter(
          ([id]) => id !== tabId,
        );
        if (remainingTabs.length > 0) {
          const [nextTabId, nextTab] = remainingTabs[0];
          mainWindow.addBrowserView(nextTab.view);
          activeTabId = nextTabId;
        } else {
          activeTabId = null;
        }
      }

      // Destroy the view
      (tab.view.webContents as any).destroy();
      browserTabs.delete(tabId);

      console.log(`🔴 Tab ${tabId} closed`);
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to close tab:", error);
      throw new Error(`Failed to close tab: ${error.message}`);
    }
  });

  // Get all tabs
  ipcMain.handle("browserview:get-tabs", async () => {
    try {
      const tabs = Array.from(browserTabs.entries()).map(([id, tab]) => ({
        id,
        title: tab.title,
        url: tab.url,
        isActive: id === activeTabId,
      }));

      return { success: true, tabs };
    } catch (error: any) {
      console.error("❌ Failed to get tabs:", error);
      throw new Error(`Failed to get tabs: ${error.message}`);
    }
  });

  // Navigate active tab to URL
  ipcMain.handle("browserview:navigate", async (event, url: string) => {
    try {
      if (!activeTabId) {
        throw new Error("No active tab");
      }

      const tab = browserTabs.get(activeTabId);
      if (!tab) {
        throw new Error("Active tab not found");
      }

      console.log(`🔗 Navigating active tab to ${url}`);
      await tab.view.webContents.loadURL(url);
      tab.url = url;
      browserTabs.set(activeTabId, tab);

      console.log("✅ Navigation successful");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to navigate:", error);
      throw new Error(`Failed to navigate: ${error.message}`);
    }
  });

  // Update active tab bounds
  ipcMain.handle(
    "browserview:set-bounds",
    async (
      event,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      try {
        // Store bounds for use when switching tabs
        lastBounds = bounds;

        if (!activeTabId) {
          return { success: true }; // No active tab, nothing to update
        }

        const tab = browserTabs.get(activeTabId);
        if (!tab) {
          throw new Error("Active tab not found");
        }

        tab.view.setBounds(bounds);
        return { success: true };
      } catch (error: any) {
        console.error("❌ Failed to set bounds:", error);
        throw new Error(`Failed to set bounds: ${error.message}`);
      }
    },
  );

  // Reload active tab
  ipcMain.handle("browserview:reload", async () => {
    try {
      if (!activeTabId) {
        throw new Error("No active tab");
      }

      const tab = browserTabs.get(activeTabId);
      if (!tab) {
        throw new Error("Active tab not found");
      }

      tab.view.webContents.reload();
      console.log("🔄 Active tab reloaded");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to reload:", error);
      throw new Error(`Failed to reload: ${error.message}`);
    }
  });

  // Navigate back in active tab
  ipcMain.handle("browserview:go-back", async () => {
    try {
      if (!activeTabId) {
        throw new Error("No active tab");
      }

      const tab = browserTabs.get(activeTabId);
      if (!tab) {
        throw new Error("Active tab not found");
      }

      if (tab.view.webContents.canGoBack()) {
        tab.view.webContents.goBack();
        console.log("⬅️ Active tab navigated back");
      }
      return {
        success: true,
        canGoBack: tab.view.webContents.canGoBack(),
      };
    } catch (error: any) {
      console.error("❌ Failed to go back:", error);
      throw new Error(`Failed to go back: ${error.message}`);
    }
  });

  // Navigate forward in active tab
  ipcMain.handle("browserview:go-forward", async () => {
    try {
      if (!activeTabId) {
        throw new Error("No active tab");
      }

      const tab = browserTabs.get(activeTabId);
      if (!tab) {
        throw new Error("Active tab not found");
      }

      if (tab.view.webContents.canGoForward()) {
        tab.view.webContents.goForward();
        console.log("➡️ Active tab navigated forward");
      }
      return {
        success: true,
        canGoForward: tab.view.webContents.canGoForward(),
      };
    } catch (error: any) {
      console.error("❌ Failed to go forward:", error);
      throw new Error(`Failed to go forward: ${error.message}`);
    }
  });

  // Check navigation state of active tab
  ipcMain.handle("browserview:can-navigate", async () => {
    try {
      if (!activeTabId) {
        throw new Error("No active tab");
      }

      const tab = browserTabs.get(activeTabId);
      if (!tab) {
        throw new Error("Active tab not found");
      }

      return {
        success: true,
        canGoBack: tab.view.webContents.canGoBack(),
        canGoForward: tab.view.webContents.canGoForward(),
      };
    } catch (error: any) {
      console.error("❌ Failed to check navigation state:", error);
      throw new Error(`Failed to check navigation state: ${error.message}`);
    }
  });

  // Open DevTools for active tab
  ipcMain.handle("browserview:open-devtools", async () => {
    try {
      if (!activeTabId) {
        throw new Error("No active tab");
      }

      const tab = browserTabs.get(activeTabId);
      if (!tab) {
        throw new Error("Active tab not found");
      }

      tab.view.webContents.openDevTools();
      console.log("🔍 DevTools opened for active tab");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to open DevTools:", error);
      throw new Error(`Failed to open DevTools: ${error.message}`);
    }
  });

  // Close DevTools for active tab
  ipcMain.handle("browserview:close-devtools", async () => {
    try {
      if (!activeTabId) {
        throw new Error("No active tab");
      }

      const tab = browserTabs.get(activeTabId);
      if (!tab) {
        throw new Error("Active tab not found");
      }

      tab.view.webContents.closeDevTools();
      console.log("🔍 DevTools closed for active tab");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to close DevTools:", error);
      throw new Error(`Failed to close DevTools: ${error.message}`);
    }
  });

  // Destroy all tabs
  ipcMain.handle("browserview:destroy", async () => {
    try {
      console.log("🔴 Destroying all tabs");

      for (const [tabId, tab] of browserTabs.entries()) {
        mainWindow.removeBrowserView(tab.view);
        (tab.view.webContents as any).destroy();
      }

      browserTabs.clear();
      activeTabId = null;

      console.log("✅ All tabs destroyed");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Failed to destroy tabs:", error);
      throw new Error(`Failed to destroy tabs: ${error.message}`);
    }
  });

  // Legacy handler for backward compatibility (creates first tab)
  ipcMain.handle(
    "browserview:create",
    async (
      event,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      // Directly call the create-tab logic for backward compatibility
      try {
        const tabId = generateTabId();
        console.log(`🌐 Creating legacy tab ${tabId} with bounds:`, bounds);

        const view = new BrowserView({
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            devTools: true,
            partition: `persist:tab_${tabId}`, // Unique session per tab
          },
        });

        // Listen for console messages
        view.webContents.on(
          "console-message",
          (event, level, message, line, sourceId) => {
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

            mainWindow.webContents.send("browser:console-log", {
              message,
              type: logType,
              source: sourceId,
              line,
              tabId,
            });
          },
        );

        const tab: BrowserTab = {
          id: tabId,
          view,
          title: "Main",
          url: "",
        };

        browserTabs.set(tabId, tab);
        mainWindow.addBrowserView(view);
        view.setBounds(bounds);
        view.setAutoResize({ width: true, height: true });
        activeTabId = tabId;

        console.log(`✅ Legacy tab ${tabId} created successfully`);
        return { success: true };
      } catch (error: any) {
        console.error("❌ Failed to create legacy tab:", error);
        throw new Error(`Failed to create legacy tab: ${error.message}`);
      }
    },
  );

  console.log("✅ BrowserView IPC handlers registered");
}
