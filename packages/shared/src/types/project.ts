export interface FileAnalysis {
  has_package_json: boolean;
  has_cargo_toml: boolean;
  has_requirements_txt: boolean;
  has_gemfile: boolean;
  dependencies: string[];
  file_count: number;
  total_size: number;
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
