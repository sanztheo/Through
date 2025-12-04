import { analyzeProjectFiles } from "@through/native";
import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

export class CommandSuggester {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private async analyzeProject(projectPath: string) {
    console.log("[Step 1] Analyzing project files with Rust...");

    let fileAnalysis;
    try {
      fileAnalysis = analyzeProjectFiles(projectPath);
    } catch (error) {
      console.error("Rust analysis error:", error);
      fileAnalysis = {
        hasPackageJson: false,
        dependencies: [],
        fileCount: 0,
      };
    }

    console.log("[Step 2] Reading package.json...");
    let packageJson: any = {};

    if (fileAnalysis.hasPackageJson) {
      try {
        const packagePath = path.join(projectPath, "package.json");
        const packageContent = fs.readFileSync(packagePath, "utf-8");
        packageJson = JSON.parse(packageContent);
      } catch (error) {
        console.error("Failed to read package.json:", error);
      }
    }

    return { fileAnalysis, packageJson };
  }

  private detectFrameworks(dependencies: string[]): string[] {
    const frameworks: string[] = [];

    const frameworkMap: Record<string, string> = {
      next: "Next.js",
      react: "React",
      vue: "Vue.js",
      "@angular/core": "Angular",
      svelte: "Svelte",
      express: "Express",
      fastify: "Fastify",
      nestjs: "NestJS",
      vite: "Vite",
      electron: "Electron",
      "react-native": "React Native",
    };

    for (const dep of dependencies) {
      for (const [key, framework] of Object.entries(frameworkMap)) {
        if (dep.includes(key)) {
          if (!frameworks.includes(framework)) {
            frameworks.push(framework);
          }
        }
      }
    }

    return frameworks;
  }

  async suggestCommands(projectPath: string): Promise<string[]> {
    console.log(`[CommandSuggester] Analyzing project: ${projectPath}`);

    try {
      const { fileAnalysis, packageJson } =
        await this.analyzeProject(projectPath);

      console.log("[Step 3] AI analyzing to suggest commands...");

      const scripts = packageJson?.scripts || {};
      const dependencies = [
        ...Object.keys(packageJson?.dependencies || {}),
        ...Object.keys(packageJson?.devDependencies || {}),
      ];

      const frameworks = this.detectFrameworks(dependencies);

      const prompt = `You are a development environment expert. Analyze this project and suggest the EXACT commands to start development servers.

Project Analysis:
- Has package.json: ${fileAnalysis.hasPackageJson}
- Detected frameworks: ${frameworks.join(", ") || "None"}
- Available scripts: ${JSON.stringify(scripts, null, 2)}
- Dependencies: ${dependencies.slice(0, 15).join(", ")}

Instructions:
1. Suggest commands to start development (1-2 commands max)
2. Use EXACT script names from package.json
3. If monorepo: suggest separate frontend/backend commands
4. Return ONLY valid JSON

Return JSON format:
{
  "commands": ["npm run dev"],
  "reasoning": "Brief explanation"
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);

      const commands = parsed.commands || [];
      console.log("[CommandSuggester] Suggested:", commands);
      console.log("[CommandSuggester] Reasoning:", parsed.reasoning);

      return commands.length > 0 ? commands : this.fallbackCommands(scripts);
    } catch (error) {
      console.error("[CommandSuggester] Error:", error);
      return ["npm run dev"];
    }
  }

  private fallbackCommands(scripts: Record<string, string>): string[] {
    if (scripts.dev) return ["npm run dev"];
    if (scripts.start) return ["npm start"];
    if (scripts["dev:web"]) return ["npm run dev:web"];
    return ["npm run dev"];
  }
}
