import OpenAI from "openai";
import { getConfig } from "../utils/config";
import type { FileAnalysis, ProjectDetection } from "@through/shared";

export class OpenAIClient {
  private client: OpenAI;

  constructor() {
    const config = getConfig();
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  async analyzeProject(
    projectPath: string,
    fileAnalysis: FileAnalysis,
  ): Promise<ProjectDetection> {
    const prompt = this.buildAnalysisPrompt(projectPath, fileAnalysis);

    try {
      console.log("Calling OpenAI API for project analysis...");
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a project analyzer that detects web development frameworks and their launch configurations. Respond ONLY with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("Empty response from OpenAI");
      }

      console.log("OpenAI analysis complete");
      return this.parseAndValidateResponse(response);
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      throw new Error(`Failed to analyze project: ${error.message}`);
    }
  }

  private buildAnalysisPrompt(
    projectPath: string,
    fileAnalysis: FileAnalysis,
  ): string {
    return `
Analyze this project and determine how to launch its development server:

Project Path: ${projectPath}

File Analysis:
- Has package.json: ${fileAnalysis.hasPackageJson}
- Has Cargo.toml: ${fileAnalysis.hasCargoToml}
- Has requirements.txt: ${fileAnalysis.hasRequirementsTxt}
- Has Gemfile: ${fileAnalysis.hasGemfile}
- Dependencies found: ${fileAnalysis.dependencies.join(", ")}
- File count: ${fileAnalysis.fileCount}

Determine:
1. Framework/tool (Next.js, Vite, Create React App, Vue, Angular, etc.)
2. Package manager (npm, yarn, pnpm, bun)
3. Start command to launch dev server
4. Build command (if applicable)
5. Default port the server runs on
6. Your confidence level (0.0-1.0)

Respond with JSON:
{
  "framework": "string",
  "packageManager": "string",
  "startCommand": "string",
  "buildCommand": "string",
  "defaultPort": number,
  "confidence": number,
  "reasoning": "string"
}
    `.trim();
  }

  private parseAndValidateResponse(response: string): ProjectDetection {
    const data = JSON.parse(response);

    if (!data.framework || !data.startCommand) {
      throw new Error("Invalid response: missing required fields");
    }

    if (data.confidence < 0 || data.confidence > 1) {
      throw new Error("Invalid confidence value");
    }

    return data as ProjectDetection;
  }
}
