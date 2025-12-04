import { analyzeProjectFiles, listProjectFiles } from "@through/native";
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
    console.log("[Step 1] Analyzing project structure with Rust...");

    // Use Rust to list all files and find package.json locations
    const allPackageJsons: Array<{ dir: string; packageJson: any }> = [];

    try {
      const files = listProjectFiles(projectPath, 3);
      console.log(
        `[Step 2] Found ${files.length} top-level items, searching for package.json files...`,
      );

      // Recursive function to find all package.json files
      const findPackageJsons = (nodes: any[], currentPath: string) => {
        for (const node of nodes) {
          const nodePath = path.join(currentPath, node.name);

          if (node.type === "file" && node.name === "package.json") {
            try {
              const content = fs.readFileSync(nodePath, "utf-8");
              const parsed = JSON.parse(content);
              const relativeDir = path.relative(
                projectPath,
                path.dirname(nodePath),
              );
              allPackageJsons.push({
                dir: relativeDir || ".",
                packageJson: parsed,
              });
              console.log(
                `   ✓ Found package.json in: ${relativeDir || "root"}`,
              );
            } catch (error) {
              console.error(`   ✗ Failed to read ${nodePath}:`, error);
            }
          }

          if (node.type === "folder" && node.children) {
            findPackageJsons(node.children, nodePath);
          }
        }
      };

      findPackageJsons(files, projectPath);
      console.log(
        `[Step 3] Total package.json files found: ${allPackageJsons.length}`,
      );
    } catch (error) {
      console.error("Rust analysis error:", error);
    }

    return { allPackageJsons };
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
      const { allPackageJsons } = await this.analyzeProject(projectPath);

      if (allPackageJsons.length === 0) {
        console.log("[CommandSuggester] No package.json found");
        return [];
      }

      console.log("[Step 4] AI analyzing to suggest commands...");

      // Build context for ALL packages, let AI decide which are relevant
      const packageContexts = allPackageJsons.map((pkg) => ({
        directory: pkg.dir,
        scripts: pkg.packageJson.scripts || {},
        dependencies: [
          ...Object.keys(pkg.packageJson.dependencies || {}),
          ...Object.keys(pkg.packageJson.devDependencies || {}),
        ],
        frameworks: this.detectFrameworks([
          ...Object.keys(pkg.packageJson.dependencies || {}),
          ...Object.keys(pkg.packageJson.devDependencies || {}),
        ]),
      }));

      const prompt = `You are a development environment expert. Analyze this project and suggest the EXACT commands to start the MAIN development servers ONLY.

Project Structure (${allPackageJsons.length} packages found):
${packageContexts
  .map(
    (ctx, i) => `
Package ${i + 1} (${ctx.directory === "." ? "root" : ctx.directory}):
- Frameworks: ${ctx.frameworks.join(", ") || "None"}
- Scripts: ${JSON.stringify(ctx.scripts, null, 2)}
- Key deps: ${ctx.dependencies.slice(0, 10).join(", ")}
`,
  )
  .join("\n")}

Operating System: ${this.platform === "darwin" ? "macOS" : this.platform === "win32" ? "Windows" : "Linux"}

CRITICAL INSTRUCTIONS:
1. ONLY suggest commands for MAIN application packages (frontend, backend, web, api, server, app)
2. IGNORE test/docs/examples/playground/demo/shared packages - these are NOT main servers
3. Maximum 2-3 commands (typically 1 frontend + 1 backend)
4. Use correct OS syntax:
   - macOS/Linux: cd folder && npm run dev
   - Windows: cd folder & npm run dev
5. If root directory: just "npm run dev" (no cd)
6. Order: frontend first, then backend
7. Return ONLY valid JSON

Example good output:
{
  "commands": ["cd pen-frontend && npm run dev", "cd pen-backend && npm start"],
  "reasoning": "Frontend React app and backend Express API - main application servers"
}

Example bad output (DON'T DO THIS):
{
  "commands": ["cd docs && npm run dev", "cd tests && npm run test", ...],
  "reasoning": "..."
}

Return JSON format:
{
  "commands": ["cd frontend && npm run dev"],
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

      return commands.length > 0
        ? commands
        : this.fallbackFromAllPackages(packageContexts);
    } catch (error) {
      console.error("[CommandSuggester] Error:", error);
      return [];
    }
  }

  private fallbackFromAllPackages(
    contexts: Array<{ directory: string; scripts: Record<string, string> }>,
  ): string[] {
    const commands: string[] = [];

    for (const ctx of contexts) {
      const separator = this.platform === "win32" ? " & " : " && ";
      const cdPrefix =
        ctx.directory === "." ? "" : `cd ${ctx.directory}${separator}`;

      if (ctx.scripts.dev) {
        commands.push(`${cdPrefix}npm run dev`);
      } else if (ctx.scripts.start) {
        commands.push(`${cdPrefix}npm start`);
      }
    }

    return commands;
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
