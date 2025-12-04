import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { analyzeProjectFiles } from "@through/native";
import * as fs from "fs";
import * as path from "path";

interface ProjectState {
  projectPath: string;
  fileAnalysis?: {
    hasPackageJson: boolean;
    dependencies: string[];
    fileCount: number;
  };
  packageJson?: Record<string, any>;
  suggestedCommands: string[];
  reasoning?: string;
}

export class CommandSuggester {
  private model: ChatOpenAI;
  private graph: any; // Simplified type to avoid complex LangGraph generics

  constructor() {
    // Initialize OpenAI model
    this.model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Build the LangGraph workflow
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    // Node 1: Analyze files using Rust NAPI (fast)
    const analyzeFilesNode = async (
      state: ProjectState,
    ): Promise<Partial<ProjectState>> => {
      console.log("[Agent] Step 1: Analyzing project files with Rust...");

      try {
        const analysis = analyzeProjectFiles(state.projectPath);
        return {
          fileAnalysis: {
            hasPackageJson: analysis.hasPackageJson,
            dependencies: analysis.dependencies,
            fileCount: analysis.fileCount,
          },
        };
      } catch (error) {
        console.error("Rust file analysis error:", error);
        return {
          fileAnalysis: {
            hasPackageJson: false,
            dependencies: [],
            fileCount: 0,
          },
        };
      }
    };

    // Node 2: Read package.json if exists
    const readPackageNode = async (
      state: ProjectState,
    ): Promise<Partial<ProjectState>> => {
      console.log("[Agent] Step 2: Reading package.json...");

      if (!state.fileAnalysis?.hasPackageJson) {
        return { packageJson: {} };
      }

      try {
        const packagePath = path.join(state.projectPath, "package.json");
        const packageContent = fs.readFileSync(packagePath, "utf-8");
        const packageJson = JSON.parse(packageContent);
        return { packageJson };
      } catch (error) {
        console.error("Failed to read package.json:", error);
        return { packageJson: {} };
      }
    };

    // Node 3: AI suggests commands based on analysis
    const suggestCommandsNode = async (
      state: ProjectState,
    ): Promise<Partial<ProjectState>> => {
      console.log(
        "[Agent] Step 3: AI analyzing project to suggest commands...",
      );

      const { fileAnalysis, packageJson } = state;

      // Build context for AI
      const context = {
        hasPackageJson: fileAnalysis?.hasPackageJson || false,
        dependencies: fileAnalysis?.dependencies || [],
        scripts: packageJson?.scripts || {},
        devDependencies: Object.keys(packageJson?.devDependencies || {}),
        dependencies_prod: Object.keys(packageJson?.dependencies || {}),
      };

      // Detect frameworks from dependencies
      const frameworks = this.detectFrameworks(
        context.dependencies.concat(context.dependencies_prod),
      );

      const prompt = `You are a development environment expert. Analyze this project and suggest the EXACT commands to start development servers.

Project Analysis:
- Has package.json: ${context.hasPackageJson}
- Detected frameworks: ${frameworks.join(", ") || "None detected"}
- Available scripts in package.json: ${JSON.stringify(context.scripts, null, 2)}
- Dependencies: ${context.dependencies.slice(0, 10).join(", ")}

Instructions:
1. Suggest ONLY the commands needed to start development (usually 1-2 commands)
2. If it's a monorepo with frontend + backend, suggest both commands separately
3. Use EXACT script names from package.json (e.g., "npm run dev", "npm start")
4. Return ONLY the commands, one per line, no explanations
5. If no dev command exists, suggest "npm run dev" or "npm start" as fallback

Examples:
- Next.js: "npm run dev"
- Vite React: "npm run dev"
- Monorepo: "npm run dev:frontend" and "npm run dev:backend"
- Electron: "npm run dev:electron" and "npm run dev:web"

Return format (JSON):
{
  "commands": ["command1", "command2"],
  "reasoning": "Brief explanation of why these commands"
}`;

      try {
        const response = await this.model.invoke(prompt);
        const content = response.content.toString();

        // Try to parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            suggestedCommands: parsed.commands || [],
            reasoning: parsed.reasoning || "",
          };
        }

        // Fallback: extract commands from text
        const lines = content
          .split("\n")
          .filter(
            (line) =>
              line.trim().startsWith("npm ") ||
              line.trim().startsWith("yarn ") ||
              line.trim().startsWith("pnpm "),
          );
        return {
          suggestedCommands: lines.length > 0 ? lines : ["npm run dev"],
          reasoning: "Fallback to default dev command",
        };
      } catch (error) {
        console.error("AI command suggestion error:", error);
        // Fallback: check package.json scripts
        const scripts = state.packageJson?.scripts || {};
        const defaultCommands = [];

        if (scripts.dev) defaultCommands.push("npm run dev");
        else if (scripts.start) defaultCommands.push("npm start");
        else defaultCommands.push("npm run dev");

        return {
          suggestedCommands: defaultCommands,
          reasoning: "Fallback to package.json scripts",
        };
      }
    };

    // Build the state graph
    const graph = new StateGraph<ProjectState>({
      channels: {
        projectPath: null,
        fileAnalysis: null,
        packageJson: null,
        suggestedCommands: null,
        reasoning: null,
      },
    })
      .addNode("analyze_files", analyzeFilesNode)
      .addNode("read_package", readPackageNode)
      .addNode("suggest_commands", suggestCommandsNode)
      .addEdge(START, "analyze_files")
      .addEdge("analyze_files", "read_package")
      .addEdge("read_package", "suggest_commands")
      .addEdge("suggest_commands", END);

    return graph.compile();
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
      const initialState: ProjectState = {
        projectPath,
        suggestedCommands: [],
      };

      const result = await this.graph.invoke(initialState);

      console.log(
        `[CommandSuggester] Suggested commands:`,
        result.suggestedCommands,
      );
      console.log(`[CommandSuggester] Reasoning:`, result.reasoning);

      return result.suggestedCommands || ["npm run dev"];
    } catch (error) {
      console.error("[CommandSuggester] Error:", error);
      return ["npm run dev"]; // Fallback
    }
  }
}
