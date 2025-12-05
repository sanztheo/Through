import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
import { BrowserWindow } from "electron";

export interface CloneProgress {
  stage: "cloning" | "receiving" | "resolving" | "done" | "error";
  percent?: number;
  message: string;
}

export interface CloneResult {
  success: boolean;
  projectPath: string;
  projectName: string;
  error?: string;
}

/**
 * Service for Git operations
 */
export class GitManager {
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * Clone a public repository
   */
  async cloneRepository(url: string, destPath: string): Promise<CloneResult> {
    // Extract repo name from URL
    const repoName = this.extractRepoName(url);
    const fullPath = path.join(destPath, repoName);

    console.log(`🔄 Cloning ${url} to ${fullPath}`);

    // Check if destination already exists
    try {
      await fs.access(fullPath);
      return {
        success: false,
        projectPath: fullPath,
        projectName: repoName,
        error: `Le dossier "${repoName}" existe déjà dans cette destination`,
      };
    } catch {
      // Directory doesn't exist, good to proceed
    }

    return new Promise((resolve) => {
      const args = ["clone", "--progress", url, fullPath];
      const gitProcess = spawn("git", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.sendProgress({
        stage: "cloning",
        message: `Clonage de ${repoName}...`,
      });

      // Git outputs progress to stderr
      gitProcess.stderr.on("data", (data: Buffer) => {
        const output = data.toString();
        console.log(`[Git] ${output}`);

        // Parse progress
        const progress = this.parseGitProgress(output);
        if (progress) {
          this.sendProgress(progress);
        }
      });

      gitProcess.stdout.on("data", (data: Buffer) => {
        console.log(`[Git stdout] ${data.toString()}`);
      });

      gitProcess.on("close", (code) => {
        if (code === 0) {
          this.sendProgress({
            stage: "done",
            percent: 100,
            message: "Clonage terminé !",
          });
          resolve({
            success: true,
            projectPath: fullPath,
            projectName: repoName,
          });
        } else {
          this.sendProgress({
            stage: "error",
            message: `Échec du clonage (code ${code})`,
          });
          resolve({
            success: false,
            projectPath: fullPath,
            projectName: repoName,
            error: `Git clone failed with code ${code}`,
          });
        }
      });

      gitProcess.on("error", (err) => {
        console.error("[Git] Error:", err);
        this.sendProgress({
          stage: "error",
          message: `Erreur: ${err.message}`,
        });
        resolve({
          success: false,
          projectPath: fullPath,
          projectName: repoName,
          error: err.message,
        });
      });
    });
  }

  /**
   * Extract repository name from URL
   */
  private extractRepoName(url: string): string {
    // Handle URLs like:
    // https://github.com/user/repo.git
    // https://github.com/user/repo
    // git@github.com:user/repo.git
    const match = url.match(/\/([^\/]+?)(\.git)?$/);
    if (match) {
      return match[1];
    }
    // Fallback: use last segment
    return url.split("/").pop()?.replace(".git", "") || "cloned-repo";
  }

  /**
   * Parse git clone progress output
   */
  private parseGitProgress(output: string): CloneProgress | null {
    // Receiving objects: 100% (1234/1234), 5.00 MiB | 2.50 MiB/s, done.
    const receivingMatch = output.match(/Receiving objects:\s+(\d+)%/);
    if (receivingMatch) {
      return {
        stage: "receiving",
        percent: parseInt(receivingMatch[1]),
        message: `Réception des objets: ${receivingMatch[1]}%`,
      };
    }

    // Resolving deltas: 100% (456/456), done.
    const resolvingMatch = output.match(/Resolving deltas:\s+(\d+)%/);
    if (resolvingMatch) {
      return {
        stage: "resolving",
        percent: parseInt(resolvingMatch[1]),
        message: `Résolution des deltas: ${resolvingMatch[1]}%`,
      };
    }

    // Cloning into 'repo'...
    if (output.includes("Cloning into")) {
      return {
        stage: "cloning",
        message: "Initialisation du clonage...",
      };
    }

    return null;
  }

  /**
   * Send progress to renderer
   */
  private sendProgress(progress: CloneProgress) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("git:clone-progress", progress);
    }
  }

  /**
   * Check if git is available
   */
  async isGitAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const gitProcess = spawn("git", ["--version"]);
      gitProcess.on("close", (code) => resolve(code === 0));
      gitProcess.on("error", () => resolve(false));
    });
  }
}

// Singleton instance
export const gitManager = new GitManager();
