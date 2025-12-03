export interface FileAnalysis {
  hasPackageJson: boolean;
  hasCargoToml: boolean;
  hasRequirementsTxt: boolean;
  hasGemfile: boolean;
  dependencies: string[];
  fileCount: number;
  totalSize: number;
}

export interface ProjectDetection {
  framework: string;
  packageManager: string;
  startCommand: string;
  buildCommand: string;
  defaultPort: number;
  confidence: number;
  reasoning: string;
}

export interface ProjectAnalysis {
  projectPath: string;
  detection: ProjectDetection;
  analyzedAt: string;
  fileAnalysis: {
    fileCount: number;
    totalSize: number;
    dependencies: string[];
  };
}

export interface CacheEntry {
  analysis: ProjectAnalysis;
  cachedAt: string;
  projectHash: string;
}
