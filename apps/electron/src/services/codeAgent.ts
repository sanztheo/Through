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
  reactComponent?: {
    name: string;
    filePath: string;
    lineNumber: number;
    props: Record<string, any>;
  };
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
    
    // Check if we have a direct file hit
    let directFilePath = "";
    if (elementInfo.reactComponent && elementInfo.reactComponent.filePath) {
      // Normalize path (handle absolute paths from React DevTools)
      let sourcePath = elementInfo.reactComponent.filePath;
      if (path.isAbsolute(sourcePath) && sourcePath.startsWith(projectPath)) {
        sourcePath = path.relative(projectPath, sourcePath);
      }
      directFilePath = sourcePath;
      console.log(`🎯 Direct React match: ${directFilePath} (Line ${elementInfo.reactComponent.lineNumber})`);
    }

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
          // Handle absolute paths if passed by mistake, but prefer relative
          const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
          const content = await fs.readFile(fullPath, "utf-8");
          return { content, path: filePath };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    });

    const replaceInFileTool = tool({
      description: "Replace a specific block of code in a file. SAFER than rewriting the whole file.",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file"),
        search: z.string().describe("The EXACT existing code block to replace (must match character-for-character, including whitespace/indentation)"),
        replace: z.string().describe("The new code block to insert"),
        explanation: z.string().describe("Why this change is being made"),
      }),
      execute: async ({ filePath, search, replace, explanation }) => {
        console.log(`✏️ Patching: ${filePath}`);
        
        try {
          const fullPath = path.join(projectPath, filePath);
          const content = await fs.readFile(fullPath, "utf-8");

          // Normalize line endings for better matching
          const normalizedContent = content.replace(/\r\n/g, "\n");
          const normalizedSearch = search.replace(/\r\n/g, "\n");

          if (!normalizedContent.includes(normalizedSearch)) {
            // Try to be smart if exact match fails: check if it's an indentation issue
            // or return a helpful error
            console.error("❌ Search block not found in file");
            console.log("Expected:", JSON.stringify(normalizedSearch));
            return { 
              success: false, 
              error: "Original code block not found in file. Please ensure 'search' matches EXACTLY the existing code, including indentation. Use readFile to verify." 
            };
          }

          const backupPath = fullPath + ".through-backup";
          
          // Create backup
          await fs.writeFile(backupPath, content, "utf-8");

          // Perform replacement
          const newContent = normalizedContent.replace(normalizedSearch, replace);
          await fs.writeFile(fullPath, newContent, "utf-8");

          // Store pending change info
          pendingChanges.set(backupPath, {
            originalPath: fullPath,
            backupPath,
            originalContent: content,
          });

          console.log(`✅ File patched: ${filePath}`);
          
          lastWriteResult = { 
            success: true, 
            filePath, 
            backupPath,
            explanation,
          };
          
          return lastWriteResult;
        } catch (error: any) {
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
      system: `You are an EXPERT frontend developer specialized in modifying EXISTING code.

ELEMENT CONTEXT:
${elementContext}

<CRITICAL_RULES>
⚠️ NEVER create new files - ONLY modify existing files
⚠️ NEVER add dependencies or config files that don't exist
⚠️ Find the ACTUAL file containing the element and modify IT
⚠️ If no Tailwind, use plain CSS in existing stylesheets
⚠️ Work with what the project already has
</CRITICAL_RULES>

<WORKFLOW>
${directFilePath ? `1. 🚨 IMMEDIATE ACTION: The user selected a React component at "${directFilePath}". READ THIS FILE FIRST.` : `1. Use searchInProject to find the element by its ID, classes, or text content`}
${directFilePath ? `2. Modify this file directly using replaceInFile.` : `2. Read the found file to understand its structure`}
${directFilePath ? `3. Only search elsewhere if strictly necessary.` : `3. Modify ONLY that existing file using replaceInFile - NEVER rewrite the whole file`}
4. If styling needed, find existing CSS/SCSS files and modify those
</WORKFLOW>

<STYLING_RULES>
- If project uses Tailwind: add utility classes to existing elements
- If project uses CSS/SCSS: modify existing stylesheets
- If inline styles exist: modify inline styles
- NEVER add Tailwind config if project doesn't use Tailwind
- NEVER create new component files
</STYLING_RULES>

<OUTPUT_RULES>
- Use replaceInFile for SURGICAL updates
- Provide the EXACT original code in 'search' (copy-paste from readFile input)
- Keep indentation consistent
- Only change what's absolutely necessary
</OUTPUT_RULES>`,
      prompt: userPrompt,
      tools: {
        searchInProject: searchInProjectTool,
        readFile: readFileTool,
        replaceInFile: replaceInFileTool,
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

  if (element.reactComponent) {
    lines.push(`--- REACT COMPONENT ---`);
    lines.push(`Component Name: <${element.reactComponent.name}>`);
    lines.push(`Source File: ${element.reactComponent.filePath}`);
    lines.push(`Line Number: ${element.reactComponent.lineNumber}`);
    
    // Add interesting props (skip children, complex objects)
    const simpleProps = Object.entries(element.reactComponent.props)
      .filter(([key, value]) => {
        return key !== "children" && 
               (typeof value === "string" || typeof value === "number" || typeof value === "boolean");
      })
      .map(([key, value]) => `${key}={${JSON.stringify(value)}}`);
      
    if (simpleProps.length > 0) {
      lines.push(`Props: ${simpleProps.join(" ")}`);
    }
    lines.push(`-----------------------`);
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
