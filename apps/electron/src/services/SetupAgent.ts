import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
import { BrowserWindow } from "electron";

export interface InstallProgress {
  stage: "detecting" | "installing" | "done" | "error";
  percent?: number;
  message: string;
  packageManager?: string;
}

export interface InstallResult {
  success: boolean;
  packageManager: string;
  error?: string;
}

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

/**
 * Service for detecting and installing dependencies
 */
export class SetupAgent {
  private mainWindow: BrowserWindow | null = null;
  private currentProcess: ChildProcess | null = null;

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * Detect package manager and install dependencies
   */
  async installDependencies(projectPath: string): Promise<InstallResult> {
    console.log(`📦 Installing dependencies in ${projectPath}`);

    this.sendProgress({
      stage: "detecting",
      message: "Détection du gestionnaire de paquets...",
    });

    // Detect package manager
    const packageManager = await this.detectPackageManager(projectPath);

    if (!packageManager) {
      this.sendProgress({
        stage: "error",
        message: "Aucun package.json trouvé",
      });
      return {
        success: false,
        packageManager: "none",
        error: "No package.json found in the project",
      };
    }

    console.log(`📦 Detected package manager: ${packageManager}`);

    this.sendProgress({
      stage: "installing",
      message: `Installation avec ${packageManager}...`,
      packageManager,
    });

    // Get install command
    const { command, args } = this.getInstallCommand(packageManager);

    return new Promise((resolve) => {
      this.currentProcess = spawn(command, args, {
        cwd: projectPath,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let outputBuffer = "";

      this.currentProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        outputBuffer += output;
        console.log(`[${packageManager}] ${output}`);

        // Parse progress from output
        const progress = this.parseInstallProgress(output, packageManager);
        if (progress) {
          this.sendProgress({
            stage: "installing",
            message: progress,
            packageManager,
          });
        }
      });

      this.currentProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.log(`[${packageManager} stderr] ${output}`);
        
        // Some package managers output progress to stderr
        if (!output.toLowerCase().includes("error") && !output.toLowerCase().includes("err!")) {
          const progress = this.parseInstallProgress(output, packageManager);
          if (progress) {
            this.sendProgress({
              stage: "installing",
              message: progress,
              packageManager,
            });
          }
        }
      });

      this.currentProcess.on("close", (code) => {
        this.currentProcess = null;
        
        if (code === 0) {
          this.sendProgress({
            stage: "done",
            percent: 100,
            message: "Dépendances installées !",
            packageManager,
          });
          resolve({
            success: true,
            packageManager,
          });
        } else {
          this.sendProgress({
            stage: "error",
            message: `Échec de l'installation (code ${code})`,
            packageManager,
          });
          resolve({
            success: false,
            packageManager,
            error: `Install failed with code ${code}`,
          });
        }
      });

      this.currentProcess.on("error", (err) => {
        this.currentProcess = null;
        console.error(`[${packageManager}] Error:`, err);
        this.sendProgress({
          stage: "error",
          message: `Erreur: ${err.message}`,
          packageManager,
        });
        resolve({
          success: false,
          packageManager,
          error: err.message,
        });
      });
    });
  }

  /**
   * Detect which package manager to use based on lock files
   */
  private async detectPackageManager(projectPath: string): Promise<PackageManager | null> {
    const lockFiles = [
      { file: "bun.lockb", manager: "bun" as PackageManager },
      { file: "pnpm-lock.yaml", manager: "pnpm" as PackageManager },
      { file: "yarn.lock", manager: "yarn" as PackageManager },
      { file: "package-lock.json", manager: "npm" as PackageManager },
    ];

    // First check for lock files (most reliable)
    for (const { file, manager } of lockFiles) {
      try {
        await fs.access(path.join(projectPath, file));
        return manager;
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check if package.json exists (default to npm)
    try {
      await fs.access(path.join(projectPath, "package.json"));
      return "npm";
    } catch {
      return null;
    }
  }

  /**
   * Get the install command for a package manager
   */
  private getInstallCommand(pm: PackageManager): { command: string; args: string[] } {
    switch (pm) {
      case "bun":
        return { command: "bun", args: ["install"] };
      case "pnpm":
        return { command: "pnpm", args: ["install"] };
      case "yarn":
        return { command: "yarn", args: ["install"] };
      case "npm":
      default:
        return { command: "npm", args: ["install"] };
    }
  }

  /**
   * Parse install progress from output
   */
  private parseInstallProgress(output: string, pm: PackageManager): string | null {
    const trimmed = output.trim();
    if (!trimmed) return null;

    // npm specific
    if (pm === "npm") {
      if (trimmed.includes("added")) return trimmed;
      if (trimmed.includes("packages")) return trimmed;
    }

    // yarn specific
    if (pm === "yarn") {
      if (trimmed.includes("Resolving")) return "Résolution des dépendances...";
      if (trimmed.includes("Fetching")) return "Téléchargement des paquets...";
      if (trimmed.includes("Linking")) return "Liaison des dépendances...";
    }

    // pnpm specific
    if (pm === "pnpm") {
      if (trimmed.includes("Resolving")) return "Résolution...";
      if (trimmed.includes("Downloading")) return "Téléchargement...";
      if (trimmed.includes("Progress")) return trimmed;
    }

    // bun specific
    if (pm === "bun") {
      if (trimmed.includes("Resolving")) return "Résolution...";
      if (trimmed.includes("Downloading")) return "Téléchargement...";
    }

    // Generic - show last meaningful line
    const lines = trimmed.split("\n").filter(l => l.trim());
    const lastLine = lines[lines.length - 1];
    if (lastLine && lastLine.length < 100) {
      return lastLine;
    }

    return null;
  }

  /**
   * Send progress to renderer
   */
  private sendProgress(progress: InstallProgress) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("setup:install-progress", progress);
    }
  }

  /**
   * Cancel ongoing installation
   */
  cancel() {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
      this.currentProcess = null;
    }
  }
}

// Singleton instance
export const setupAgent = new SetupAgent();
