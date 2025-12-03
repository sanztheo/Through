import { analyzeProjectFiles } from "@through/native";
import { OpenAIClient } from "./OpenAIClient";
import type { ProjectAnalysis } from "@through/shared";

export class ProjectAnalyzer {
  private openai: OpenAIClient;

  constructor() {
    this.openai = new OpenAIClient();
  }

  async analyze(projectPath: string): Promise<ProjectAnalysis> {
    console.log(`Analyzing project: ${projectPath}`);

    // Step 1: Fast native file analysis (Rust NAPI)
    console.log("Step 1: Analyzing files with Rust NAPI...");
    const fileAnalysis = analyzeProjectFiles(projectPath);
    console.log(
      `Found ${fileAnalysis.fileCount} files, ${fileAnalysis.dependencies.length} dependencies`,
    );

    // Step 2: AI-powered project detection (OpenAI)
    console.log("Step 2: Detecting framework with OpenAI...");
    const detection = await this.openai.analyzeProject(
      projectPath,
      fileAnalysis,
    );
    console.log(
      `Detected: ${detection.framework} (${detection.confidence * 100}% confidence)`,
    );

    const analysis: ProjectAnalysis = {
      projectPath,
      detection,
      analyzedAt: new Date().toISOString(),
      fileAnalysis: {
        fileCount: fileAnalysis.fileCount,
        totalSize: fileAnalysis.totalSize,
        dependencies: fileAnalysis.dependencies,
      },
    };

    console.log("Project analysis complete");
    return analysis;
  }
}
