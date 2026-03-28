use std::path::PathBuf;
use std::process::Stdio;
use tauri::path::BaseDirectory;
use tauri::AppHandle;
use tauri::Manager;
use tokio::io::AsyncReadExt;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use crate::state::AppState;

#[cfg(target_os = "windows")]
mod win_process_guard {
    use std::io;
    use std::mem::{size_of, zeroed};
    use std::ptr;
    use std::sync::LazyLock;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::System::JobObjects::AssignProcessToJobObject;
    use windows_sys::Win32::System::JobObjects::CreateJobObjectW;
    use windows_sys::Win32::System::JobObjects::JobObjectExtendedLimitInformation;
    use windows_sys::Win32::System::JobObjects::SetInformationJobObject;
    use windows_sys::Win32::System::JobObjects::JOBOBJECT_EXTENDED_LIMIT_INFORMATION;
    use windows_sys::Win32::System::JobObjects::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    use windows_sys::Win32::System::Threading::OpenProcess;
    use windows_sys::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION;
    use windows_sys::Win32::System::Threading::PROCESS_SET_QUOTA;
    use windows_sys::Win32::System::Threading::PROCESS_TERMINATE;

    struct JobHandle(HANDLE);

    unsafe impl Send for JobHandle {}
    unsafe impl Sync for JobHandle {}

    impl Drop for JobHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    let _ = CloseHandle(self.0);
                }
            }
        }
    }

    static ENGINE_JOB: LazyLock<Result<JobHandle, String>> = LazyLock::new(|| unsafe {
        let job = CreateJobObjectW(ptr::null(), ptr::null());
        if job.is_null() {
            return Err(format!(
                "CreateJobObjectW failed: {}",
                io::Error::last_os_error()
            ));
        }

        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        let ok = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if ok == 0 {
            let err = io::Error::last_os_error();
            let _ = CloseHandle(job);
            return Err(format!("SetInformationJobObject failed: {}", err));
        }

        Ok(JobHandle(job))
    });

    pub fn bind_pid(pid: u32) -> Result<(), String> {
        let job = ENGINE_JOB
            .as_ref()
            .map_err(|e| format!("Engine job unavailable: {}", e))?;

        unsafe {
            let process = OpenProcess(
                PROCESS_SET_QUOTA | PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION,
                0,
                pid,
            );
            if process.is_null() {
                return Err(format!(
                    "OpenProcess({pid}) failed: {}",
                    io::Error::last_os_error()
                ));
            }

            let ok = AssignProcessToJobObject(job.0, process);
            let _ = CloseHandle(process);
            if ok == 0 {
                return Err(format!(
                    "AssignProcessToJobObject({pid}) failed: {}",
                    io::Error::last_os_error()
                ));
            }
        }

        Ok(())
    }
}

pub const SESSION_FILENAME: &str = "download.session";
pub const LOG_FILENAME: &str = "aria2.log";
const PROTECTED_EXTRA_ARG_KEYS: &[&str] = &[
    "conf-path",
    "save-session",
    "input-file",
    "log",
    "no-conf",
    "enable-rpc",
    "rpc-listen-all",
    "rpc-allow-origin-all",
    "rpc-listen-port",
    "rpc-secret",
];

static ENGINE_PROCESS: std::sync::LazyLock<Mutex<Option<Child>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

/// Find a file under `extra/<platform>/<arch>/engine/`.
/// Search order: Tauri resource resolver (prod), then relative dev path fallback.
fn resolve_engine_file(
    handle: &AppHandle,
    filename: &str,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let platform_dir = get_platform_dir();
    let arch_dirs = get_engine_arch_dirs();
    let primary_arch = arch_dirs.first().copied().unwrap_or_else(get_arch_dir);
    let mut attempted = Vec::new();

    for arch_dir in arch_dirs {
        for rel_path in engine_rel_paths(platform_dir, arch_dir, filename) {
            let dev_candidate = PathBuf::from(&rel_path);
            let resource_candidate = handle
                .path()
                .resolve(&rel_path, BaseDirectory::Resource)
                .ok();

            let prefer_dev = cfg!(debug_assertions);
            let mut candidates = Vec::new();
            if prefer_dev {
                candidates.push(dev_candidate.clone());
            }
            if let Some(ref candidate) = resource_candidate {
                candidates.push(candidate.clone());
            }
            if !prefer_dev {
                candidates.push(dev_candidate.clone());
            }

            for candidate in candidates {
                attempted.push(candidate.to_string_lossy().to_string());
                if !candidate.exists() {
                    continue;
                }

                let resolved = candidate
                    .canonicalize()
                    .unwrap_or_else(|_| candidate.clone());
                if arch_dir != primary_arch {
                    log::warn!(
                        "{} for {}/{} not found; using fallback arch {}/{}",
                        filename,
                        platform_dir,
                        primary_arch,
                        platform_dir,
                        arch_dir
                    );
                }
                log::info!("{} found at: {:?}", filename, resolved);
                return Ok(resolved);
            }
        }
    }

    attempted.sort();
    attempted.dedup();
    let attempted_preview = attempted
        .iter()
        .take(8)
        .cloned()
        .collect::<Vec<_>>()
        .join(", ");
    Err(format!(
        "{} not found in any search path (checked {} paths; first attempts: {})",
        filename,
        attempted.len(),
        attempted_preview
    )
    .into())
}

fn engine_rel_paths(platform_dir: &str, arch_dir: &str, filename: &str) -> Vec<String> {
    vec![
        format!("../extra/{}/{}/engine/{}", platform_dir, arch_dir, filename),
        format!("extra/{}/{}/engine/{}", platform_dir, arch_dir, filename),
    ]
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

    let mut command = Command::new(&bin_path);
    command
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    command.kill_on_drop(true);
    configure_engine_spawn(&mut command);
    let mut child = command.spawn()?;

    #[cfg(target_os = "windows")]
    {
        if let Some(pid) = child.id() {
            if let Err(e) = win_process_guard::bind_pid(pid) {
                let kill_err = child.kill().await.err();
                let msg = if let Some(kill_err) = kill_err {
                    format!(
                        "Failed to bind aria2c into process job: {}; also failed to kill child: {}",
                        e, kill_err
                    )
                } else {
                    format!(
                        "Failed to bind aria2c into process job: {}; startup aborted to avoid orphan process",
                        e
                    )
                };
                log::error!("{}", msg);
                *state.engine_running.lock().unwrap() = false;
                return Err(msg.into());
            }
        } else {
            let kill_err = child.kill().await.err();
            let msg = if let Some(kill_err) = kill_err {
                format!(
                    "Failed to get aria2c process id after spawn; startup aborted and kill failed: {}",
                    kill_err
                )
            } else {
                "Failed to get aria2c process id after spawn; startup aborted".to_string()
            };
            log::error!("{}", msg);
            *state.engine_running.lock().unwrap() = false;
            return Err(msg.into());
        }
    }

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
    std::fs::create_dir_all(&config_dir)?;

    let session_path = config_dir.join(SESSION_FILENAME);
    let session_path_str = session_path.to_string_lossy().to_string();
    let log_dir = handle
        .path()
        .app_log_dir()
        .unwrap_or_else(|_| config_dir.clone());
    std::fs::create_dir_all(&log_dir)?;
    let log_path = log_dir.join(LOG_FILENAME);

    // Create the session file if it does not exist.
    if !session_path.exists() {
        if let Some(parent) = session_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::File::create(&session_path)?;
    }

    // Find aria2.conf.
    let conf = resolve_engine_file(handle, "aria2.conf")?;

    let mut args = vec![
        format!("--conf-path={}", conf.to_string_lossy()),
        format!("--save-session={}", session_path_str),
        format!("--log={}", log_path.to_string_lossy()),
    ];

    if std::fs::metadata(&session_path)
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

    if let Some(dir) = sys.get("dir").and_then(|v| v.as_str()) {
        if !dir.trim().is_empty() {
            std::fs::create_dir_all(dir)?;
        }
    }

    for (k, v) in sys {
        // Skip values that should not be passed to aria2.
        if (k == "rpc-secret" && v.as_str() == Some(""))
            || matches!(
                k.as_str(),
                "save-session" | "input-file" | "conf-path" | "log"
            )
        {
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

    // Large torrents can generate large RPC payloads when submitted via addTorrent.
    // Ensure aria2 won't reject valid requests with default small request-size limits.
    if !args
        .iter()
        .any(|arg| arg.starts_with("--rpc-max-request-size="))
    {
        args.push("--rpc-max-request-size=128M".to_string());
    }

    if let Some(extra_args) = user.get("aria2-extra-args").and_then(|v| v.as_str()) {
        merge_custom_args(&mut args, extra_args);
    }
    clamp_max_connection_per_server(&mut args);

    Ok(args)
}

fn merge_custom_args(base_args: &mut Vec<String>, extra_args: &str) {
    let tokens = split_command_line_args(extra_args);
    if tokens.is_empty() {
        return;
    }

    let mut merged_extra = Vec::new();
    let mut i = 0usize;

    while i < tokens.len() {
        let token = &tokens[i];
        if token.trim().is_empty() {
            i += 1;
            continue;
        }

        let key = parse_long_option_key(token).map(str::to_string);
        let has_separate_value = key.is_some()
            && !token.contains('=')
            && i + 1 < tokens.len()
            && !tokens[i + 1].starts_with('-');
        let span = if has_separate_value { 2 } else { 1 };

        if let Some(ref key) = key {
            if PROTECTED_EXTRA_ARG_KEYS.contains(&key.as_str()) {
                log::warn!("Ignoring protected aria2-extra-args option: --{}", key);
                i += span;
                continue;
            }

            base_args.retain(|arg| !arg_matches_option_key(arg, key));
        }

        merged_extra.push(token.clone());
        if span == 2 {
            merged_extra.push(tokens[i + 1].clone());
        }
        i += span;
    }

    base_args.extend(merged_extra);
}

fn parse_long_option_key(token: &str) -> Option<&str> {
    if !token.starts_with("--") || token == "--" {
        return None;
    }

    let body = &token[2..];
    if body.is_empty() {
        return None;
    }

    Some(body.split('=').next().unwrap_or(body))
}

fn arg_matches_option_key(arg: &str, key: &str) -> bool {
    arg == format!("--{}", key) || arg.starts_with(&format!("--{}=", key))
}

fn clamp_max_connection_per_server(args: &mut [String]) {
    let mut i = 0usize;
    while i < args.len() {
        if let Some(raw) = args[i].strip_prefix("--max-connection-per-server=") {
            let val = raw.parse::<u32>().unwrap_or(16);
            if val > 16 {
                args[i] = "--max-connection-per-server=16".to_string();
                log::warn!("Clamped max-connection-per-server from {} to 16", val);
            }
        } else if args[i] == "--max-connection-per-server" && i + 1 < args.len() {
            let val = args[i + 1].parse::<u32>().unwrap_or(16);
            if val > 16 {
                args[i + 1] = "16".to_string();
                log::warn!("Clamped max-connection-per-server from {} to 16", val);
            }
            i += 1;
        }

        i += 1;
    }
}

fn split_command_line_args(input: &str) -> Vec<String> {
    #[derive(Copy, Clone, Eq, PartialEq)]
    enum QuoteMode {
        None,
        Single,
        Double,
    }

    let mut result = Vec::new();
    let mut current = String::new();
    let mut quote_mode = QuoteMode::None;
    let mut escaping = false;

    for ch in input.chars() {
        match quote_mode {
            QuoteMode::None => {
                if escaping {
                    current.push(ch);
                    escaping = false;
                    continue;
                }

                match ch {
                    '\\' => escaping = true,
                    '\'' => quote_mode = QuoteMode::Single,
                    '"' => quote_mode = QuoteMode::Double,
                    c if c.is_whitespace() => {
                        if !current.is_empty() {
                            result.push(std::mem::take(&mut current));
                        }
                    }
                    _ => current.push(ch),
                }
            }
            QuoteMode::Single => {
                if ch == '\'' {
                    quote_mode = QuoteMode::None;
                } else {
                    current.push(ch);
                }
            }
            QuoteMode::Double => {
                if escaping {
                    current.push(ch);
                    escaping = false;
                    continue;
                }

                match ch {
                    '\\' => escaping = true,
                    '"' => quote_mode = QuoteMode::None,
                    _ => current.push(ch),
                }
            }
        }
    }

    if escaping {
        current.push('\\');
    }
    if !current.is_empty() {
        result.push(current);
    }
    if quote_mode != QuoteMode::None {
        log::warn!(
            "aria2-extra-args contains an unmatched quote; parsed arguments may be incomplete"
        );
    }

    result
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

fn get_engine_arch_dirs() -> Vec<&'static str> {
    let primary = get_arch_dir();
    if cfg!(target_os = "windows") && primary == "arm64" {
        vec!["arm64", "x64", "ia32"]
    } else {
        vec![primary]
    }
}

#[cfg(target_os = "windows")]
fn configure_engine_spawn(command: &mut Command) {
    // Prevent aria2c from opening a separate console window.
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn configure_engine_spawn(_command: &mut Command) {}

#[cfg(test)]
mod tests {
    use super::{clamp_max_connection_per_server, merge_custom_args, split_command_line_args};

    #[test]
    fn split_command_line_args_splits_flags() {
        let args = split_command_line_args("--summary-interval=0 --disk-cache=64M");
        assert_eq!(args, vec!["--summary-interval=0", "--disk-cache=64M"]);
    }

    #[test]
    fn split_command_line_args_supports_quoted_values() {
        let args = split_command_line_args("--header=\"User-Agent: Test UA\" '--out=hello world'");
        assert_eq!(
            args,
            vec!["--header=User-Agent: Test UA", "--out=hello world"]
        );
    }

    #[test]
    fn split_command_line_args_supports_escaped_spaces() {
        let args = split_command_line_args("--out=hello\\ world --check-integrity=true");
        assert_eq!(args, vec!["--out=hello world", "--check-integrity=true"]);
    }

    #[test]
    fn merge_custom_args_overrides_same_key_from_base() {
        let mut base = vec!["--dir=/downloads".to_string(), "--split=5".to_string()];
        merge_custom_args(&mut base, "--split=16 --disk-cache=64M");
        assert_eq!(
            base,
            vec![
                "--dir=/downloads".to_string(),
                "--split=16".to_string(),
                "--disk-cache=64M".to_string(),
            ]
        );
    }

    #[test]
    fn merge_custom_args_keeps_protected_keys_from_base() {
        let mut base = vec![
            "--rpc-listen-port=16800".to_string(),
            "--rpc-secret=abc".to_string(),
            "--dir=/downloads".to_string(),
        ];
        merge_custom_args(
            &mut base,
            "--rpc-listen-port=17000 --rpc-secret=override --dir=/tmp",
        );
        assert_eq!(
            base,
            vec![
                "--rpc-listen-port=16800".to_string(),
                "--rpc-secret=abc".to_string(),
                "--dir=/tmp".to_string(),
            ]
        );
    }

    #[test]
    fn merge_custom_args_blocks_rpc_disabling_flags() {
        let mut base = vec![
            "--conf-path=/tmp/aria2.conf".to_string(),
            "--rpc-listen-port=16800".to_string(),
            "--rpc-secret=abc".to_string(),
            "--enable-rpc=true".to_string(),
            "--rpc-listen-all=true".to_string(),
            "--rpc-allow-origin-all=true".to_string(),
            "--dir=/downloads".to_string(),
        ];

        merge_custom_args(
            &mut base,
            "--no-conf --enable-rpc=false --rpc-listen-all=false --rpc-allow-origin-all=false --dir=/tmp",
        );

        assert_eq!(
            base,
            vec![
                "--conf-path=/tmp/aria2.conf".to_string(),
                "--rpc-listen-port=16800".to_string(),
                "--rpc-secret=abc".to_string(),
                "--enable-rpc=true".to_string(),
                "--rpc-listen-all=true".to_string(),
                "--rpc-allow-origin-all=true".to_string(),
                "--dir=/tmp".to_string(),
            ]
        );
    }

    #[test]
    fn clamp_max_connection_per_server_handles_custom_override() {
        let mut args = vec![
            "--max-connection-per-server=20".to_string(),
            "--max-connection-per-server".to_string(),
            "99".to_string(),
        ];
        clamp_max_connection_per_server(&mut args);
        assert_eq!(
            args,
            vec![
                "--max-connection-per-server=16".to_string(),
                "--max-connection-per-server".to_string(),
                "16".to_string(),
            ]
        );
    }
}
