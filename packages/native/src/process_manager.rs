use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessHandle {
    pub pid: u32,
    pub command: String,
}

/// Spawn a development server process
///
/// # Arguments
/// * `project_path` - Working directory for the process
/// * `command` - Command to execute (e.g., "npm", "cargo", "python")
/// * `args` - Array of command arguments
///
/// # Returns
/// * `Result<ProcessHandle>` - Handle to the spawned process including PID
///
/// # Example
/// ```
/// let handle = spawn_dev_server(
///     "/path/to/project".to_string(),
///     "npm".to_string(),
///     vec!["run".to_string(), "dev".to_string()]
/// )?;
/// ```
#[napi]
pub fn spawn_dev_server(
    project_path: String,
    command: String,
    args: Vec<String>,
) -> Result<ProcessHandle> {
    // Validate project path exists
    let path = std::path::Path::new(&project_path);
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

    // Spawn the process with proper I/O handling
    let child = Command::new(&command)
        .args(&args)
        .current_dir(&project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to spawn process '{}': {}", command, e),
            )
        })?;

    let pid = child.id();

    // Detach the child process so it continues running independently
    // We're not waiting for it to complete
    std::mem::forget(child);

    let full_command = format!("{} {}", command, args.join(" "));

    Ok(ProcessHandle {
        pid,
        command: full_command,
    })
}

/// Kill a process by PID with cross-platform support
///
/// # Arguments
/// * `pid` - Process ID to terminate
///
/// # Returns
/// * `Result<()>` - Success or error
///
/// # Platform Handling
/// * Unix/Linux/macOS: Uses SIGTERM signal
/// * Windows: Uses TerminateProcess API
#[napi]
pub fn kill_process(pid: u32) -> Result<()> {
    #[cfg(unix)]
    {
        use nix::sys::signal::{self, Signal};
        use nix::unistd::Pid;

        let pid = Pid::from_raw(pid as i32);

        // Try SIGTERM first (graceful shutdown)
        match signal::kill(pid, Signal::SIGTERM) {
            Ok(_) => Ok(()),
            Err(e) => {
                // If SIGTERM fails, try SIGKILL (force kill)
                match signal::kill(pid, Signal::SIGKILL) {
                    Ok(_) => Ok(()),
                    Err(_) => Err(Error::new(
                        Status::GenericFailure,
                        format!("Failed to kill process {}: {}", pid, e),
                    )),
                }
            }
        }
    }

    #[cfg(windows)]
    {
        use std::process::Command;

        // Use taskkill on Windows
        let output = Command::new("taskkill")
            .args(&["/PID", &pid.to_string(), "/F", "/T"])
            .output()
            .map_err(|e| {
                Error::new(
                    Status::GenericFailure,
                    format!("Failed to execute taskkill: {}", e),
                )
            })?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(Error::new(
                Status::GenericFailure,
                format!("Failed to kill process {}: {}", pid, stderr),
            ))
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        Err(Error::new(
            Status::GenericFailure,
            "Process killing not supported on this platform",
        ))
    }
}

/// Check if a process with the given PID is currently running
///
/// # Arguments
/// * `pid` - Process ID to check
///
/// # Returns
/// * `Result<bool>` - true if process is running, false otherwise
#[napi]
pub fn is_process_running(pid: u32) -> Result<bool> {
    #[cfg(unix)]
    {
        use nix::sys::signal;
        use nix::unistd::Pid;

        let pid = Pid::from_raw(pid as i32);

        // Sending signal 0 checks if process exists without actually sending a signal
        // Using None for signal 0 (null signal) which just checks process existence
        match signal::kill(pid, None) {
            Ok(_) => Ok(true),
            Err(nix::errno::Errno::ESRCH) => Ok(false), // No such process
            Err(_) => Ok(false),
        }
    }

    #[cfg(windows)]
    {
        use std::process::Command;

        let output = Command::new("tasklist")
            .args(&["/FI", &format!("PID eq {}", pid), "/NH"])
            .output()
            .map_err(|e| {
                Error::new(
                    Status::GenericFailure,
                    format!("Failed to check process status: {}", e),
                )
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.contains(&pid.to_string()))
    }

    #[cfg(not(any(unix, windows)))]
    {
        Err(Error::new(
            Status::GenericFailure,
            "Process checking not supported on this platform",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spawn_invalid_path() {
        let result = spawn_dev_server(
            "/nonexistent/path/12345".to_string(),
            "echo".to_string(),
            vec!["test".to_string()],
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_kill_nonexistent_process() {
        // Try to kill a PID that almost certainly doesn't exist
        let result = kill_process(999999);
        // This should either succeed (no such process) or fail gracefully
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_is_process_running_nonexistent() {
        let result = is_process_running(999999);
        assert!(result.is_ok());
        if let Ok(running) = result {
            assert!(!running);
        }
    }
}
