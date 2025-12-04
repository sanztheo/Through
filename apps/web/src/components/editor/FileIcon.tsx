"use client";

import React from "react";
import {
  VscJson,
  VscSymbolFile,
  VscCode,
  VscMarkdown,
  VscSettingsGear,
} from "react-icons/vsc";
import {
  SiTypescript,
  SiJavascript,
  SiReact,
  SiHtml5,
  SiCss3,
  SiSass,
  SiPython,
  SiRust,
  SiGo,
  SiDocker,
  SiYaml,
  SiGit,
} from "react-icons/si";

interface FileIconProps {
  filename: string;
  className?: string;
}

// Map file extensions to their icons and colors
const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
  // JavaScript/TypeScript
  ".js": { icon: SiJavascript, color: "#F7DF1E" },
  ".mjs": { icon: SiJavascript, color: "#F7DF1E" },
  ".cjs": { icon: SiJavascript, color: "#F7DF1E" },
  ".jsx": { icon: SiReact, color: "#61DAFB" },
  ".ts": { icon: SiTypescript, color: "#3178C6" },
  ".tsx": { icon: SiReact, color: "#61DAFB" },

  // Web
  ".html": { icon: SiHtml5, color: "#E34F26" },
  ".htm": { icon: SiHtml5, color: "#E34F26" },
  ".css": { icon: SiCss3, color: "#1572B6" },
  ".scss": { icon: SiSass, color: "#CC6699" },
  ".sass": { icon: SiSass, color: "#CC6699" },
  ".less": { icon: SiCss3, color: "#1D365D" },

  // Data
  ".json": { icon: VscJson, color: "#FBC02D" },
  ".yaml": { icon: SiYaml, color: "#CB171E" },
  ".yml": { icon: SiYaml, color: "#CB171E" },
  ".xml": { icon: VscCode, color: "#FF6600" },
  ".toml": { icon: VscSettingsGear, color: "#9C4121" },

  // Markdown/Docs
  ".md": { icon: VscMarkdown, color: "#083FA1" },
  ".mdx": { icon: VscMarkdown, color: "#FCB32C" },
  ".txt": { icon: VscSymbolFile, color: "#6B7280" },

  // Programming Languages
  ".py": { icon: SiPython, color: "#3776AB" },
  ".rs": { icon: SiRust, color: "#DEA584" },
  ".go": { icon: SiGo, color: "#00ADD8" },

  // Config
  ".env": { icon: VscSettingsGear, color: "#ECD53F" },
  ".gitignore": { icon: SiGit, color: "#F05032" },
  ".dockerignore": { icon: SiDocker, color: "#2496ED" },
  "Dockerfile": { icon: SiDocker, color: "#2496ED" },
  "docker-compose.yml": { icon: SiDocker, color: "#2496ED" },
  "docker-compose.yaml": { icon: SiDocker, color: "#2496ED" },
};

// Special filenames
const specialFiles: Record<string, { icon: React.ElementType; color: string }> = {
  "package.json": { icon: VscJson, color: "#CB3837" },
  "package-lock.json": { icon: VscJson, color: "#CB3837" },
  "tsconfig.json": { icon: SiTypescript, color: "#3178C6" },
  "tailwind.config.js": { icon: SiCss3, color: "#06B6D4" },
  "tailwind.config.ts": { icon: SiCss3, color: "#06B6D4" },
  "vite.config.js": { icon: VscSettingsGear, color: "#646CFF" },
  "vite.config.ts": { icon: VscSettingsGear, color: "#646CFF" },
  "next.config.js": { icon: VscSettingsGear, color: "#000000" },
  "next.config.mjs": { icon: VscSettingsGear, color: "#000000" },
  ".gitignore": { icon: SiGit, color: "#F05032" },
  "Dockerfile": { icon: SiDocker, color: "#2496ED" },
  "Cargo.toml": { icon: SiRust, color: "#DEA584" },
  "Cargo.lock": { icon: SiRust, color: "#DEA584" },
};

export function FileIcon({ filename, className = "w-4 h-4" }: FileIconProps) {
  // Check for special filenames first
  if (specialFiles[filename]) {
    const { icon: Icon, color } = specialFiles[filename];
    return <Icon className={className} style={{ color }} />;
  }

  // Get file extension
  const ext = filename.includes(".")
    ? "." + filename.split(".").pop()?.toLowerCase()
    : "";

  // Find matching icon
  const iconConfig = iconMap[ext];

  if (iconConfig) {
    const { icon: Icon, color } = iconConfig;
    return <Icon className={className} style={{ color }} />;
  }

  // Default file icon
  return <VscSymbolFile className={className} style={{ color: "#6B7280" }} />;
}

// Get Monaco language from file extension
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.includes(".")
    ? "." + filename.split(".").pop()?.toLowerCase()
    : "";

  const languageMap: Record<string, string> = {
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".json": "json",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "scss",
    ".less": "less",
    ".md": "markdown",
    ".mdx": "markdown",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".toml": "toml",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".vue": "vue",
    ".svelte": "svelte",
    ".php": "php",
    ".rb": "ruby",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
  };

  return languageMap[ext] || "plaintext";
}
