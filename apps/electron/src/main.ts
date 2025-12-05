import { app, BrowserWindow, nativeImage } from "electron";
import path from "path";
import { loadConfig } from "./utils/config";
import { registerProjectHandlers } from "./ipc/project";
import { registerServerHandlers } from "./ipc/server";
import { registerFilesystemHandlers } from "./ipc/filesystem";
import { registerBrowserViewHandlers } from "./ipc/browserview";
import { registerAgentHandlers } from "./ipc/agent";
import { registerGitHandlers } from "./ipc/git";

// Security configuration
const SECURITY_CONFIG = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  webviewTag: true, // Enable <webview> for localhost display
};

let mainWindow: BrowserWindow | null = null;

async function createMainWindow() {
  // Determine icon path based on platform (use PNG for reliability)
  const iconPath = process.platform === "darwin"
    ? path.join(__dirname, "../assets/icons/1024x1024.png")
    : path.join(__dirname, "../assets/icons/icon.ico");
  
  // Load icon image (may fail silently if file not found)
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.warn("⚠️ Icon image is empty, using default");
      icon = undefined;
    }
  } catch (e) {
    console.warn("⚠️ Failed to load icon:", e);
    icon = undefined;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: "Through - Project Analyzer",
    icon: icon,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      ...SECURITY_CONFIG,
    },
  });

  // Set dock icon on macOS (use PNG for better compatibility)
  if (process.platform === "darwin" && app.dock && icon) {
    try {
      app.dock.setIcon(icon);
    } catch (e) {
      console.warn("⚠️ Failed to set dock icon:", e);
    }
  }

  // Development vs Production URL loading
  const isDev = process.env.NODE_ENV === "development";
  const startUrl = isDev
    ? "http://localhost:49123"
    : `file://${path.join(__dirname, "../../web/out/index.html")}`;

  console.log(`Loading URL: ${startUrl}`);
  await mainWindow.loadURL(startUrl);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // Load and validate configuration
    loadConfig();
    console.log("Configuration loaded");

    // Register all IPC handlers
    registerProjectHandlers();
    registerServerHandlers();
    registerFilesystemHandlers();
    registerAgentHandlers();
    console.log("IPC handlers registered");

    // Create main window
    await createMainWindow();
    console.log("Main window created");

    // Register BrowserView handlers after window is created
    if (mainWindow) {
      registerBrowserViewHandlers(mainWindow);
      registerGitHandlers(mainWindow);
    }
  } catch (error) {
    console.error("Failed to initialize app:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// Handle app quit
app.on("before-quit", async (event) => {
  event.preventDefault();
  // Stop all running servers before quitting
  if (mainWindow) {
    mainWindow.webContents.send("app:quit");
  }
  setTimeout(() => app.exit(), 1000);
});

console.log("Electron app initialized");
