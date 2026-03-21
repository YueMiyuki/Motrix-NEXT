use std::path::PathBuf;
use std::process::Stdio;
use tauri::AppHandle;
use tauri::Manager;
use tokio::io::AsyncReadExt;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use crate::state::AppState;

pub const SESSION_FILENAME: &str = "download.session";

static ENGINE_PROCESS: std::sync::LazyLock<Mutex<Option<Child>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

/// Find a file under `extra/<platform>/<arch>/engine/`.
/// Search order: resource dir (prod), parent dir (dev), then current dir.
fn resolve_engine_file(
    handle: &AppHandle,
    filename: &str,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let rel_path = PathBuf::from("extra")
        .join(get_platform_dir())
        .join(get_arch_dir())
        .join("engine")
        .join(filename);

    let resource_dir = handle
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let candidates = [
        resource_dir.join(&rel_path),
        PathBuf::from("..").join(&rel_path),
        rel_path.clone(),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            let resolved = candidate
                .canonicalize()
                .unwrap_or_else(|_| candidate.clone());
            log::info!("{} found at: {:?}", filename, resolved);
            return Ok(resolved);
        }
    }

    Err(format!("{} not found in any search path", filename).into())
}

fn is_local_rpc_host(host: &str) -> bool {
    matches!(host, "127.0.0.1" | "localhost" | "::1" | "[::1]")
}

fn should_start_embedded_engine(config: &crate::config::ConfigManager) -> bool {
    let host = config
        .get_user_config()
        .get("rpc-host")
        .and_then(|v| v.as_str())
        .unwrap_or("127.0.0.1")
        .trim()
        .to_lowercase();

    is_local_rpc_host(host.as_str())
}

pub async fn start_engine(handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state = handle.state::<AppState>();

    {
        let config = state.config.lock().unwrap();
        if !should_start_embedded_engine(&config) {
            let host = config
                .get_user_config()
                .get("rpc-host")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            log::info!(
                "Skipping embedded aria2c startup because rpc-host is set to external address: {}",
                host
            );
            *state.engine_running.lock().unwrap() = false;
            return Ok(());
        }
    }

    {
        let mut guard = ENGINE_PROCESS.lock().await;
        if let Some(existing) = guard.as_mut() {
            match existing.try_wait() {
                Ok(None) => {
                    log::info!("aria2c engine already running");
                    *state.engine_running.lock().unwrap() = true;
                    return Ok(());
                }
                Ok(Some(status)) => {
                    log::warn!("Found exited aria2c process handle: {}", status);
                    *guard = None;
                }
                Err(e) => {
                    return Err(format!("Failed to inspect aria2c process: {}", e).into());
                }
            }
        }
    }

    let (bin_path, args) = {
        let config = state.config.lock().unwrap();
        let bin_path = resolve_engine_bin(handle)?;
        let args = build_engine_args(handle, &config)?;
        (bin_path, args)
    };

    log::info!("Starting aria2c: {:?}", bin_path);
    log::info!("aria2c args: {:?}", args);

    let mut child = Command::new(&bin_path)
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()?;

    // Grab stderr so we can read startup errors if the process exits early.
    // Keep this handle until after the liveness check; dropping it too early
    // can trigger SIGPIPE in the child.
    let mut stderr_handle = child.stderr.take();

    // Give aria2c a moment to either start or fail.
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // Check whether the process is still running.
    match child.try_wait() {
        Ok(Some(status)) => {
            // The process exited, so read stderr for diagnostics.
            let stderr_output = if let Some(ref mut stderr) = stderr_handle {
                let mut buf = Vec::new();
                let _ = tokio::time::timeout(
                    std::time::Duration::from_millis(200),
                    stderr.read_to_end(&mut buf),
                )
                .await;
                if buf.is_empty() {
                    None
                } else {
                    Some(String::from_utf8_lossy(&buf).to_string())
                }
            } else {
                None
            };

            let msg = if let Some(ref err) = stderr_output {
                format!("aria2c exited immediately with {}: {}", status, err)
            } else {
                format!("aria2c exited immediately with exit status: {}", status)
            };
            log::error!("{}", msg);
            *state.engine_running.lock().unwrap() = false;
            return Err(msg.into());
        }
        Ok(None) => {
            // Still running, so startup succeeded.
            log::info!("aria2c engine started (pid alive)");
        }
        Err(e) => {
            log::error!("Failed to check aria2c status: {}", e);
        }
    }

    if let Some(mut stderr) = stderr_handle.take() {
        tauri::async_runtime::spawn(async move {
            let mut buf = [0u8; 2048];
            loop {
                match stderr.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let msg = String::from_utf8_lossy(&buf[..n]);
                        let trimmed = msg.trim();
                        if !trimmed.is_empty() {
                            log::warn!("aria2c stderr: {}", trimmed);
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to read aria2c stderr: {}", e);
                        break;
                    }
                }
            }
        });
    }

    *ENGINE_PROCESS.lock().await = Some(child);
    *state.engine_running.lock().unwrap() = true;
    Ok(())
}

pub async fn stop_engine(handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let mut guard = ENGINE_PROCESS.lock().await;
    if let Some(ref mut child) = *guard {
        child.kill().await?;
    }
    *guard = None;
    drop(guard);

    let state = handle.state::<AppState>();
    *state.engine_running.lock().unwrap() = false;
    log::info!("aria2c engine stopped");
    Ok(())
}

pub async fn restart_engine(handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    stop_engine(handle).await?;
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    start_engine(handle).await?;
    Ok(())
}

fn resolve_engine_bin(handle: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let bin_name = if cfg!(target_os = "windows") {
        "aria2c.exe"
    } else {
        "aria2c"
    };
    resolve_engine_file(handle, bin_name)
}

fn build_engine_args(
    handle: &AppHandle,
    config: &crate::config::ConfigManager,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let config_dir = handle
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let session_path = config_dir.join(SESSION_FILENAME);
    let session_path_str = session_path.to_string_lossy().to_string();

    // Create the session file if it does not exist.
    if !session_path.exists() {
        if let Some(parent) = session_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::File::create(&session_path)?;
    }

    // Find aria2.conf.
    let conf = resolve_engine_file(handle, "aria2.conf").unwrap_or_else(|_| {
        log::warn!("aria2.conf not found, using fallback path");
        PathBuf::from("aria2.conf")
    });

    let mut args = vec![
        format!("--conf-path={}", conf.to_string_lossy()),
        format!("--save-session={}", session_path_str),
    ];

    if session_path.exists()
        && std::fs::metadata(&session_path)
            .map(|m| m.len() > 0)
            .unwrap_or(false)
    {
        args.push(format!("--input-file={}", session_path_str));
    }

    // Convert system config entries into CLI args.
    let sys = config.get_system_config();
    let user = config.get_user_config();

    let idle_guard = user
        .get("idle-bt-network-guard")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    for (k, v) in sys {
        // Skip values that should not be passed to aria2.
        if k == "rpc-secret" && v.as_str() == Some("") {
            continue;
        }

        let val_str = match v {
            serde_json::Value::String(s) => {
                if s.is_empty() {
                    continue;
                }
                s.clone()
            }
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => continue,
        };

        // If idle BT guard is enabled, force BT network options off.
        if idle_guard {
            match k.as_str() {
                "bt-enable-lpd" | "enable-peer-exchange" | "enable-dht" | "enable-dht6" => {
                    args.push(format!("--{}=false", k));
                    continue;
                }
                _ => {}
            }
        }

        args.push(format!("--{}={}", k, val_str));
    }

    // aria2c caps max-connection-per-server at 16.
    if let Some(pos) = args
        .iter()
        .position(|a| a.starts_with("--max-connection-per-server="))
    {
        let val: u32 = args[pos]
            .trim_start_matches("--max-connection-per-server=")
            .parse()
            .unwrap_or(16);
        if val > 16 {
            args[pos] = format!("--max-connection-per-server={}", 16);
            log::warn!("Clamped max-connection-per-server from {} to 16", val);
        }
    }

    Ok(args)
}

fn get_platform_dir() -> &'static str {
    if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "windows") {
        "win32"
    } else {
        "linux"
    }
}

fn get_arch_dir() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "arm" => "armv7l",
        "x86" => "ia32",
        _ => "x64",
    }
}
