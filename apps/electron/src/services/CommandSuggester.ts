import { analyzeProjectFiles } from "@through/native";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import OpenAI from "openai";

export class CommandSuggester {
  private openai: OpenAI;
  private platform: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.platform = os.platform(); // 'darwin' (Mac), 'win32' (Windows), 'linux'
    console.log(`[CommandSuggester] Detected OS: ${this.platform}`);
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
    return []; // Ne rien suggérer si vraiment aucun script
  }

  /**
   * Valide et corrige une commande saisie par l'utilisateur
   */
  async validateAndFixCommand(
    projectPath: string,
    command: string,
  ): Promise<{ valid: boolean; corrected: string; issues: string[] }> {
    const issues: string[] = [];
    let corrected = command.trim();

    console.log(`[CommandSuggester] Validating command: "${command}"`);

    // 1. Parse la commande pour détecter les cd
    const cdMatch = command.match(/cd\s+([^\s&|;]+)/);
    let targetPath = projectPath;
    let actualCommand = command;

    if (cdMatch) {
      const subDir = cdMatch[1];
      targetPath = path.join(projectPath, subDir);
      console.log(`[CommandSuggester] Detected cd to: ${subDir}`);

      // Vérifier que le dossier existe
      if (!fs.existsSync(targetPath)) {
        issues.push(`Folder "${subDir}" does not exist`);
        return { valid: false, corrected: command, issues };
      }

      // Extraire la commande après le cd
      const parts = command.split(/&&|&/);
      actualCommand = parts[1]?.trim() || "";
    }

    // 2. Vérifier le format selon l'OS
    if (cdMatch) {
      const isWindows = this.platform === "win32";
      const hasSingleAmpersand =
        command.includes(" & ") && !command.includes(" && ");
      const hasDoubleAmpersand = command.includes(" && ");

      if (isWindows && hasDoubleAmpersand) {
        // Windows préfère un seul &
        corrected = corrected.replace(" && ", " & ");
        issues.push("Fixed: Windows uses single & instead of &&");
      } else if (!isWindows && hasSingleAmpersand) {
        // Mac/Linux nécessite &&
        corrected = corrected.replace(" & ", " && ");
        issues.push("Fixed: Mac/Linux requires && instead of single &");
      }
    }

    // 3. Vérifier que la commande existe dans package.json
    const packageJsonPath = path.join(targetPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8"),
        );
        const scripts = packageJson.scripts || {};

        // Extraire le script name (ex: "npm run dev" -> "dev")
        const npmRunMatch = actualCommand.match(/npm\s+run\s+(\S+)/);
        if (npmRunMatch) {
          const scriptName = npmRunMatch[1];
          if (!scripts[scriptName]) {
            issues.push(`Script "${scriptName}" not found in package.json`);

            // Suggérer le bon script
            if (scripts.dev) {
              actualCommand = actualCommand.replace(
                /npm\s+run\s+\S+/,
                "npm run dev",
              );
              corrected = cdMatch
                ? `cd ${cdMatch[1]} ${this.platform === "win32" ? "&" : "&&"} ${actualCommand}`
                : actualCommand;
              issues.push('Suggested: "npm run dev" instead');
            }
          }
        }
      } catch (error) {
        console.error("Error reading package.json:", error);
      }
    } else {
      issues.push("No package.json found in target directory");
    }

    const valid =
      issues.length === 0 || issues.every((i) => i.startsWith("Fixed:"));
    console.log(`[CommandSuggester] Validation result: ${valid ? "✅" : "❌"}`);
    console.log(`[CommandSuggester] Issues:`, issues);
    console.log(`[CommandSuggester] Corrected: "${corrected}"`);

    return { valid, corrected, issues };
  }
}
