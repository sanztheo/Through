import { ipcMain } from "electron";
import {
  launchChromiumBrowser,
  navigateToUrl,
  executeJsInBrowser,
  takeBrowserScreenshot,
  getPageContent,
  closeChromiumBrowser,
} from "@through/native";
import type { ChromiumInstance, ChromiumConfig } from "@through/shared";

export function registerChromiumHandlers() {
  console.log("Registering Chromium IPC handlers...");

  // Launch a new Chromium browser instance
  ipcMain.handle(
    "chromium:launch",
    async (event, config?: ChromiumConfig): Promise<ChromiumInstance> => {
      try {
        console.log("🚀 Launching Chromium browser with config:", config);
        const instance = await launchChromiumBrowser(config);
        console.log(`✅ Chromium launched successfully: ${instance.id}`);
        return instance;
      } catch (error: any) {
        console.error("❌ Failed to launch Chromium:", error);
        throw new Error(`Failed to launch Chromium: ${error.message}`);
      }
    },
  );

  // Navigate to a URL
  ipcMain.handle(
    "chromium:navigate",
    async (
      event,
      data: { instanceId: string; url: string },
    ): Promise<boolean> => {
      try {
        console.log(`🔗 Navigating ${data.instanceId} to ${data.url}`);
        const success = await navigateToUrl(data.instanceId, data.url);
        console.log(`✅ Navigation successful`);
        return success;
      } catch (error: any) {
        console.error("❌ Failed to navigate:", error);
        throw new Error(`Failed to navigate: ${error.message}`);
      }
    },
  );

  // Execute JavaScript in the browser
  ipcMain.handle(
    "chromium:execute-js",
    async (
      event,
      data: { instanceId: string; script: string },
    ): Promise<string> => {
      try {
        console.log(`⚡ Executing JS in ${data.instanceId}`);
        const result = await executeJsInBrowser(data.instanceId, data.script);
        return result;
      } catch (error: any) {
        console.error("❌ Failed to execute JS:", error);
        throw new Error(`Failed to execute JS: ${error.message}`);
      }
    },
  );

  // Take a screenshot
  ipcMain.handle(
    "chromium:screenshot",
    async (
      event,
      data: { instanceId: string; outputPath: string },
    ): Promise<string> => {
      try {
        console.log(`📸 Taking screenshot of ${data.instanceId}`);
        const path = await takeBrowserScreenshot(
          data.instanceId,
          data.outputPath,
        );
        console.log(`✅ Screenshot saved to ${path}`);
        return path;
      } catch (error: any) {
        console.error("❌ Failed to take screenshot:", error);
        throw new Error(`Failed to take screenshot: ${error.message}`);
      }
    },
  );

  // Get page content
  ipcMain.handle(
    "chromium:get-content",
    async (event, instanceId: string): Promise<string> => {
      try {
        console.log(`📄 Getting content from ${instanceId}`);
        const content = await getPageContent(instanceId);
        return content;
      } catch (error: any) {
        console.error("❌ Failed to get content:", error);
        throw new Error(`Failed to get content: ${error.message}`);
      }
    },
  );

  // Close browser instance
  ipcMain.handle(
    "chromium:close",
    async (event, instanceId: string): Promise<boolean> => {
      try {
        console.log(`🔴 Closing Chromium browser ${instanceId}`);
        const success = await closeChromiumBrowser(instanceId);
        console.log(`✅ Browser closed successfully`);
        return success;
      } catch (error: any) {
        console.error("❌ Failed to close browser:", error);
        throw new Error(`Failed to close browser: ${error.message}`);
      }
    },
  );

  console.log("✅ Chromium IPC handlers registered");
}
