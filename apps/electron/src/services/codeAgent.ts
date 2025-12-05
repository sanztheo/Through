import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { getSettings, AI_MODELS } from "./settings.js";

export interface ElementInfo {
  tagName: string;
  id: string | null;
  className: string | null;
  selector: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyle: Record<string, string>;
  attributes: Array<{ name: string; value: string }>;
  textContent: string | null;
}

export interface AgentResult {
  success: boolean;
  message: string;
  modifiedFile?: string;
  backupFile?: string;
  originalContent?: string;
  newContent?: string;
  error?: string;
}

// Store for pending changes (backup info)
const pendingChanges = new Map<string, {
  originalPath: string;
  backupPath: string;
  originalContent: string;
}>();

// Store the last write result for extraction
let lastWriteResult: {
  success: boolean;
  filePath: string;
  backupPath: string;
  explanation: string;
} | null = null;

/**
 * Run the AI code agent to modify code based on element info and user prompt
 */
export async function runCodeAgent(params: {
  projectPath: string;
  elementInfo: ElementInfo;
  userPrompt: string;
}): Promise<AgentResult> {
  const { projectPath, elementInfo, userPrompt } = params;

  console.log("🤖 Starting code agent...");
  console.log("📂 Project:", projectPath);
  console.log("🎯 Element:", elementInfo.selector);
  console.log("💬 Prompt:", userPrompt);

  // Reset the last write result
  lastWriteResult = null;

  try {
    // Build context about the element
    const elementContext = buildElementContext(elementInfo);

    // Define tools using the correct SDK syntax
    const searchInProjectTool = tool({
      description: "Search for text, CSS selectors, class names, or content in project files. Returns matching files with line numbers.",
      inputSchema: z.object({
        query: z.string().describe("The text, class name, or selector to search for"),
        fileExtensions: z.array(z.string()).optional().describe("File extensions to search, e.g. ['tsx', 'css']. Defaults to common web files."),
      }),
      execute: async ({ query, fileExtensions }) => {
        console.log(`🔍 Searching for: "${query}"`);
        
        const extensions = fileExtensions || ["tsx", "jsx", "ts", "js", "vue", "svelte", "css", "scss", "html"];
        const pattern = `**/*.{${extensions.join(",")}}`;
        
        try {
          const files = await glob(pattern, { 
            cwd: projectPath,
            ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**"],
          });

          const results: Array<{ file: string; lines: number[]; preview: string }> = [];

          for (const file of files.slice(0, 50)) {
            const filePath = path.join(projectPath, file);
            try {
              const content = await fs.readFile(filePath, "utf-8");
              if (content.includes(query)) {
                const lines = content.split("\n");
                const matchingLines: number[] = [];
                let preview = "";

                lines.forEach((line, index) => {
                  if (line.includes(query)) {
                    matchingLines.push(index + 1);
                    if (!preview) {
                      preview = line.trim().substring(0, 100);
                    }
                  }
                });

                if (matchingLines.length > 0) {
                  results.push({ file, lines: matchingLines, preview });
                }
              }
            } catch (e) {
              // Skip files that can't be read
            }
          }

          console.log(`📁 Found ${results.length} matching files`);
          return results;
        } catch (error: any) {
          return { error: error.message };
        }
      },
    });

    const readFileTool = tool({
      description: "Read the content of a file from the project",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file from project root"),
      }),
      execute: async ({ filePath }) => {
        console.log(`📖 Reading: ${filePath}`);
        try {
          const fullPath = path.join(projectPath, filePath);
          const content = await fs.readFile(fullPath, "utf-8");
          return { content, path: filePath };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    });

    const writeFileTool = tool({
      description: "Write modified content to a file. This will create a backup first.",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file from project root"),
        content: z.string().describe("The complete new content for the file"),
        explanation: z.string().describe("Brief explanation of what was changed"),
      }),
      execute: async ({ filePath, content, explanation }) => {
        console.log(`✏️ Writing to: ${filePath}`);
        console.log(`📝 Change: ${explanation}`);
        
        try {
          const fullPath = path.join(projectPath, filePath);
          const backupPath = fullPath + ".through-backup";

          // Read original content
          let originalContent = "";
          try {
            originalContent = await fs.readFile(fullPath, "utf-8");
          } catch (e) {
            // File might not exist yet
          }

          // Create backup
          if (originalContent) {
            await fs.writeFile(backupPath, originalContent, "utf-8");
          }

          // Write new content
          await fs.writeFile(fullPath, content, "utf-8");

          // Store pending change info
          pendingChanges.set(backupPath, {
            originalPath: fullPath,
            backupPath,
            originalContent,
          });

          console.log(`✅ File modified: ${filePath}`);
          
          // Store the result for later extraction
          lastWriteResult = { 
            success: true, 
            filePath, 
            backupPath,
            explanation,
          };
          
          return lastWriteResult;
        } catch (error: any) {
          console.error(`❌ Write failed: ${error.message}`);
          return { error: error.message };
        }
      },
    });

    const listFilesTool = tool({
      description: "List files in a directory to understand project structure",
      inputSchema: z.object({
        directory: z.string().optional().describe("Relative path to directory. Defaults to project root."),
      }),
      execute: async ({ directory }) => {
        const dir = directory || ".";
        console.log(`📂 Listing: ${dir}`);
        
        try {
          const fullPath = path.join(projectPath, dir);
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          
          return entries
            .filter(e => !e.name.startsWith(".") && e.name !== "node_modules")
            .map(e => ({
              name: e.name,
              type: e.isDirectory() ? "directory" : "file",
            }));
        } catch (error: any) {
          return { error: error.message };
        }
      },
    });

    // Get the selected model from settings
    const settings = getSettings();
    const modelConfig = AI_MODELS.find(m => m.id === settings.aiModel) || AI_MODELS.find(m => m.id === "gpt-5-mini")!;
    
    console.log(`🧠 Using model: ${modelConfig.name} (${modelConfig.provider})`);
    
    // Get the model instance based on provider
    const getModel = () => {
      switch (modelConfig.provider) {
        case "anthropic":
          return anthropic(modelConfig.modelId);
        case "google":
          return google(modelConfig.modelId);
        case "openai":
        default:
          return openai(modelConfig.modelId);
      }
    };

    const result = await generateText({
      model: getModel(),
      stopWhen: stepCountIs(10),
      system: `You are an EXPERT frontend developer specialized in modern web development.
You are exceptionally skilled in:
- **Tailwind CSS v4**: utility classes, responsive design, dark mode, animations
- **React/Next.js**: components, hooks, state management
- **CSS**: flexbox, grid, custom properties, transitions
- **Design systems**: shadcn/ui, Radix UI, daisyUI

ELEMENT CONTEXT:
${elementContext}

<INSTRUCTIONS>
1. Use searchInProject to find files containing the element's classes, ID, or text
2. Read the relevant file(s) to understand the code structure
3. Apply the modification using writeFile
</INSTRUCTIONS>

<TAILWIND_BEST_PRACTICES>
- Use modern Tailwind v4 utility classes
- Prefer semantic class combinations (flex items-center gap-2)
- Use responsive prefixes: sm:, md:, lg:, xl:
- Use dark mode: dark:bg-gray-800
- Use hover/focus states: hover:bg-blue-600 focus:ring-2
- Use transitions: transition-all duration-200
- Avoid arbitrary values when possible
</TAILWIND_BEST_PRACTICES>

<CSS_BEST_PRACTICES>
- Use CSS custom properties for theming
- Prefer flexbox/grid over floats
- Use clamp() for fluid typography
- Add smooth transitions for better UX
</CSS_BEST_PRACTICES>

<OUTPUT_RULES>
- Make minimal, targeted changes
- Preserve existing code structure
- Use the project's existing patterns and style
- Generate clean, production-ready code
</OUTPUT_RULES>`,
      prompt: userPrompt,
      tools: {
        searchInProject: searchInProjectTool,
        readFile: readFileTool,
        writeFile: writeFileTool,
        listFiles: listFilesTool,
      },
    });

    // Check if we have a successful write
    const writeResult = lastWriteResult as {
      success: boolean;
      filePath: string;
      backupPath: string;
      explanation: string;
    } | null;
    
    if (writeResult && writeResult.success) {
      const pendingChange = pendingChanges.get(writeResult.backupPath);

      return {
        success: true,
        message: writeResult.explanation || "Code modified successfully",
        modifiedFile: writeResult.filePath,
        backupFile: writeResult.backupPath,
        originalContent: pendingChange?.originalContent,
      };
    }

    return {
      success: false,
      message: result.text || "Could not find or modify the relevant code",
    };

  } catch (error: any) {
    console.error("❌ Agent error:", error);
    return {
      success: false,
      message: "Agent failed",
      error: error.message,
    };
  }
}

/**
 * Accept the pending change (delete backup)
 */
export async function acceptChange(backupPath: string): Promise<{ success: boolean }> {
  console.log(`✅ Accepting change, removing backup: ${backupPath}`);
  
  try {
    await fs.unlink(backupPath);
    pendingChanges.delete(backupPath);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to remove backup:", error);
    return { success: false };
  }
}

/**
 * Reject the pending change (restore from backup)
 */
export async function rejectChange(backupPath: string): Promise<{ success: boolean }> {
  console.log(`❌ Rejecting change, restoring from: ${backupPath}`);
  
  const pendingChange = pendingChanges.get(backupPath);
  if (!pendingChange) {
    // Try to restore anyway if the backup file exists
    try {
      const originalPath = backupPath.replace(".through-backup", "");
      const backupContent = await fs.readFile(backupPath, "utf-8");
      await fs.writeFile(originalPath, backupContent, "utf-8");
      await fs.unlink(backupPath);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to restore:", error);
      return { success: false };
    }
  }

  try {
    // Restore original content
    await fs.writeFile(pendingChange.originalPath, pendingChange.originalContent, "utf-8");
    // Remove backup
    await fs.unlink(backupPath);
    pendingChanges.delete(backupPath);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to restore:", error);
    return { success: false };
  }
}

/**
 * Build context string about the selected element
 */
function buildElementContext(element: ElementInfo): string {
  const lines: string[] = [];
  
  lines.push(`Tag: <${element.tagName}>`);
  
  if (element.id) {
    lines.push(`ID: #${element.id}`);
  }
  
  if (element.className && typeof element.className === "string") {
    const classes = element.className.trim().split(/\s+/).filter(Boolean);
    if (classes.length > 0) {
      lines.push(`Classes: ${classes.map(c => "." + c).join(", ")}`);
    }
  }
  
  lines.push(`CSS Selector: ${element.selector}`);
  
  if (element.textContent) {
    lines.push(`Text Content: "${element.textContent.substring(0, 100)}"`);
  }
  
  // Add key computed styles
  const styleLines: string[] = [];
  const importantStyles = ["display", "position", "color", "backgroundColor", "fontSize"];
  for (const prop of importantStyles) {
    if (element.computedStyle[prop] && element.computedStyle[prop] !== "none") {
      styleLines.push(`${prop}: ${element.computedStyle[prop]}`);
    }
  }
  if (styleLines.length > 0) {
    lines.push(`Computed Styles: ${styleLines.join("; ")}`);
  }
  
  // Add data attributes
  const dataAttrs = element.attributes.filter(a => a.name.startsWith("data-"));
  if (dataAttrs.length > 0) {
    lines.push(`Data Attributes: ${dataAttrs.map(a => `${a.name}="${a.value}"`).join(", ")}`);
  }
  
  return lines.join("\n");
}
