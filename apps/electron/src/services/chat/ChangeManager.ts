import * as fs from "fs/promises";
import { PendingChange } from "./types.js";

interface ChangeManagerOptions {
  emitPendingChanges: (changes: PendingChange[]) => void;
}

export class ChangeManager {
  private pendingChanges: PendingChange[] = [];
  private areChangesVisible = true;
  private emitPendingChanges: (changes: PendingChange[]) => void;

  constructor(options: ChangeManagerOptions) {
    this.emitPendingChanges = options.emitPendingChanges;
  }

  // Add a pending change to track
  addPendingChange(change: Omit<PendingChange, "id" | "timestamp">) {
    const pendingChange: PendingChange = {
      ...change,
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    this.pendingChanges.push(pendingChange);
    this.emitPendingChanges(this.pendingChanges);
    console.log(`📝 Added pending change: ${change.type} ${change.filePath}`);
  }

  // Get all pending changes
  getPendingChanges(): PendingChange[] {
    return this.pendingChanges;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async toggleChanges(visible: boolean): Promise<{ success: boolean; visible: boolean }> {
    if (visible === this.areChangesVisible) return { success: true, visible };

    console.log(`🔄 Toggling changes visibility: ${visible ? "SHOW MODIFS" : "SHOW ORIGINAL"}`);

    try {
      if (!visible) {
        // HIDE MODIFICATIONS (Show Original)
        for (const change of this.pendingChanges) {
           try {
             if (change.type === "modify" && change.backupPath) {
               // Save modified version to .modified, restore original
               await fs.copyFile(change.filePath, change.backupPath + ".modified");
               await fs.copyFile(change.backupPath, change.filePath);
             }
             else if (change.type === "create") {
               // Move created file aside (so it appears deleted/not created)
               await fs.rename(change.filePath, change.filePath + ".modified");
             }
             else if (change.type === "delete" && change.backupPath) {
               // Restore deleted file
               await fs.copyFile(change.backupPath, change.filePath);
             }
           } catch (e) {
             console.error(`Failed to toggle change ${change.filePath}`, e);
           }
        }
      } else {
        // SHOW MODIFICATIONS (Restore Modified State)
        for (const change of this.pendingChanges) {
           try {
             if (change.type === "modify" && change.backupPath) {
               // Restore modified version
               const modifiedPath = change.backupPath + ".modified";
               if (await this.fileExists(modifiedPath)) {
                  await fs.rename(modifiedPath, change.filePath);
               }
             }
             else if (change.type === "create") {
               // Restore created file
               const modifiedPath = change.filePath + ".modified";
               if (await this.fileExists(modifiedPath)) {
                  await fs.rename(modifiedPath, change.filePath);
               }
             }
             else if (change.type === "delete") {
               // Re-delete file
               if (await this.fileExists(change.filePath)) {
                 await fs.unlink(change.filePath);
               }
             }
           } catch (e) {
             console.error(`Failed to restore change ${change.filePath}`, e);
           }
        }
      }

      this.areChangesVisible = visible;
      return { success: true, visible };
    } catch (e) {
      console.error("Failed to toggle changes", e);
      return { success: false, visible: this.areChangesVisible };
    }
  }

  // Validate all pending changes (keep modifications, delete backups)
  async validateChanges(): Promise<{ success: boolean }> {
    console.log("✅ Validating all changes...");

    // If we are currently showing original, restore modifications first
    if (!this.areChangesVisible) {
      await this.toggleChanges(true);
    }

    for (const change of this.pendingChanges) {
      if (change.backupPath) {
        try {
          if (await this.fileExists(change.backupPath)) {
            await fs.unlink(change.backupPath);
            console.log(`  ✅ Removed backup: ${change.backupPath}`);
          }
          // Also clean up any potential .modified file leftovers
          const modifiedPath = change.backupPath + ".modified";
          if (await this.fileExists(modifiedPath)) {
            await fs.unlink(modifiedPath);
          }
        } catch (error) {
          console.error(`  ❌ Failed to remove backup: ${change.backupPath}`, error);
        }
      }
      // For create type, check for .modified leftover
      if (change.type === "create") {
         const modifiedPath = change.filePath + ".modified";
         if (await this.fileExists(modifiedPath)) await fs.unlink(modifiedPath);
      }
    }

    this.pendingChanges = [];
    this.areChangesVisible = true;
    this.emitPendingChanges(this.pendingChanges);
    return { success: true };
  }

  // Reject all pending changes (restore from backups)
  async rejectChanges(): Promise<{ success: boolean }> {
    console.log("❌ Rejecting all changes...");

    // If we are showing original, we just need to clean up backups and .modified files
    // Because the working copy IS the original
    if (!this.areChangesVisible) {
        console.log("  ℹ️  Already showing original, cleaning up...");
        for (const change of this.pendingChanges) {
           if (change.type === "modify" && change.backupPath) {
              const modifiedPath = change.backupPath + ".modified";
              if (await this.fileExists(modifiedPath)) await fs.unlink(modifiedPath);
              if (await this.fileExists(change.backupPath)) await fs.unlink(change.backupPath);
           }
           else if (change.type === "create") {
              const modifiedPath = change.filePath + ".modified";
              if (await this.fileExists(modifiedPath)) await fs.unlink(modifiedPath);
           }
           else if (change.type === "delete" && change.backupPath) {
               if (await this.fileExists(change.backupPath)) await fs.unlink(change.backupPath);
           }
        }
    } else {
        // Standard rejection (restore from backups)
        for (const change of this.pendingChanges) {
          try {
            if (change.type === "delete" && change.backupPath) {
              // Restore deleted file
              const backupContent = await fs.readFile(change.backupPath, "utf-8");
              await fs.writeFile(change.filePath, backupContent, "utf-8");
              await fs.unlink(change.backupPath);
              console.log(`  ✅ Restored deleted file: ${change.filePath}`);
            } else if (change.type === "modify" && change.backupPath) {
              // Restore modified file
              const backupContent = await fs.readFile(change.backupPath, "utf-8");
              await fs.writeFile(change.filePath, backupContent, "utf-8");
              await fs.unlink(change.backupPath);
              console.log(`  ✅ Restored modified file: ${change.filePath}`);
            } else if (change.type === "create") {
              // Delete created file
              await fs.unlink(change.filePath);
              console.log(`  ✅ Removed created file: ${change.filePath}`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to restore: ${change.filePath}`, error);
          }
        }
    }

    this.pendingChanges = [];
    this.areChangesVisible = true;
    this.emitPendingChanges(this.pendingChanges);
    return { success: true };
  }

  // Clear pending changes without action
  clearPendingChanges() {
    this.pendingChanges = [];
    this.emitPendingChanges(this.pendingChanges);
  }
}
