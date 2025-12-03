use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileAnalysis {
    pub has_package_json: bool,
    pub has_cargo_toml: bool,
    pub has_requirements_txt: bool,
    pub has_gemfile: bool,
    pub dependencies: Vec<String>,
    pub file_count: u32,
    pub total_size: i64,
}

/// Analyze project files and extract metadata
///
/// # Arguments
/// * `project_path` - Root path of the project to analyze
///
/// # Returns
/// * `Result<FileAnalysis>` - Analysis results including file counts, dependencies, and detected configuration files
#[napi]
pub fn analyze_project_files(project_path: String) -> Result<FileAnalysis> {
    let path = Path::new(&project_path);

    if !path.exists() {
        return Err(Error::new(
            Status::InvalidArg,
            format!("Project path does not exist: {}", project_path),
        ));
    }

    if !path.is_dir() {
        return Err(Error::new(
            Status::InvalidArg,
            format!("Project path is not a directory: {}", project_path),
        ));
    }

    // Initialize analysis result
    let mut analysis = FileAnalysis {
        has_package_json: false,
        has_cargo_toml: false,
        has_requirements_txt: false,
        has_gemfile: false,
        dependencies: Vec::new(),
        file_count: 0,
        total_size: 0,
    };

    // Check for key configuration files
    let package_json_path = path.join("package.json");
    let cargo_toml_path = path.join("Cargo.toml");
    let requirements_txt_path = path.join("requirements.txt");
    let gemfile_path = path.join("Gemfile");

    analysis.has_package_json = package_json_path.exists();
    analysis.has_cargo_toml = cargo_toml_path.exists();
    analysis.has_requirements_txt = requirements_txt_path.exists();
    analysis.has_gemfile = gemfile_path.exists();

    // Extract dependencies from package.json if it exists
    if analysis.has_package_json {
        if let Ok(package_content) = fs::read_to_string(&package_json_path) {
            if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(&package_content) {
                // Extract dependencies
                if let Some(deps) = package_json.get("dependencies").and_then(|d| d.as_object()) {
                    for key in deps.keys() {
                        analysis.dependencies.push(key.clone());
                    }
                }

                // Extract devDependencies
                if let Some(dev_deps) = package_json.get("devDependencies").and_then(|d| d.as_object()) {
                    for key in dev_deps.keys() {
                        if !analysis.dependencies.contains(key) {
                            analysis.dependencies.push(key.clone());
                        }
                    }
                }
            }
        }
    }

    // Walk directory tree respecting .gitignore
    let walker = WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let path = e.path();
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip common directories that should be ignored
            !matches!(
                file_name,
                "node_modules" | ".git" | "target" | "dist" | "build" | ".next" | "out" | "__pycache__" | ".venv" | "venv"
            )
        });

    for entry in walker {
        match entry {
            Ok(entry) => {
                if entry.file_type().is_file() {
                    analysis.file_count += 1;

                    if let Ok(metadata) = entry.metadata() {
                        analysis.total_size += metadata.len() as i64;
                    }
                }
            }
            Err(_) => {
                // Skip entries that can't be read (permission issues, etc.)
                continue;
            }
        }
    }

    Ok(analysis)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_path() {
        let result = analyze_project_files("/nonexistent/path/12345".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_file_path_instead_of_directory() {
        // Create a temp file
        let temp_file = std::env::temp_dir().join("test_file.txt");
        std::fs::write(&temp_file, "test").unwrap();

        let result = analyze_project_files(temp_file.to_string_lossy().to_string());
        assert!(result.is_err());

        // Cleanup
        let _ = std::fs::remove_file(temp_file);
    }
}
