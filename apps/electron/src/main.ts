import { app, BrowserWindow } from "electron";
import path from "path";
import { loadConfig } from "./utils/config";
import { registerProjectHandlers } from "./ipc/project";
import { registerServerHandlers } from "./ipc/server";
import { registerFilesystemHandlers } from "./ipc/filesystem";

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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: "Through - Project Analyzer",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      ...SECURITY_CONFIG,
    },
  });

  // Development vs Production URL loading
  const isDev = process.env.NODE_ENV === "development";
  const startUrl = isDev
    ? "http://localhost:3000"
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
    console.log("IPC handlers registered");

    // Create main window
    await createMainWindow();
    console.log("Main window created");
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
