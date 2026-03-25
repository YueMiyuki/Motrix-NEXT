use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::time::Duration;

use serde_json::{json, Map, Value};
use tauri::AppHandle;
use tokio::task::spawn_blocking;
use tokio::time::sleep;

const TEMP_DOWNLOAD_SUFFIX: &str = ".part";

fn encode_base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(input.len().div_ceil(3) * 4);
    let mut index = 0usize;

    while index < input.len() {
        let b0 = input[index];
        let b1 = if index + 1 < input.len() {
            input[index + 1]
        } else {
            0
        };
        let b2 = if index + 2 < input.len() {
            input[index + 2]
        } else {
            0
        };

        output.push(TABLE[(b0 >> 2) as usize] as char);
        output.push(TABLE[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);

        if index + 1 < input.len() {
            output.push(TABLE[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            output.push('=');
        }

        if index + 2 < input.len() {
            output.push(TABLE[(b2 & 0b0011_1111) as usize] as char);
        } else {
            output.push('=');
        }

        index += 3;
    }

    output
}

fn resolve_rpc_endpoint(
    state: &tauri::State<'_, crate::state::AppState>,
) -> Result<(String, u16, String), String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let user = config.get_user_config();
    let system = config.get_system_config();

    let host = user
        .get("rpc-host")
        .and_then(|value| value.as_str())
        .unwrap_or("127.0.0.1")
        .trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('/')
        .to_string();

    let port = system
        .get("rpc-listen-port")
        .and_then(|value| value.as_u64())
        .and_then(|value| u16::try_from(value).ok())
        .unwrap_or(16800);

    let secret = system
        .get("rpc-secret")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();

    Ok((host, port, secret))
}

fn split_http_response(raw: &[u8]) -> Result<&[u8], String> {
    let marker = b"\r\n\r\n";
    let Some(pos) = raw
        .windows(marker.len())
        .position(|window| window == marker)
    else {
        return Err("Invalid aria2 RPC response".to_string());
    };
    let header_end = pos + marker.len();
    let headers = &raw[..header_end];
    let status_ok = headers.starts_with(b"HTTP/1.1 200") || headers.starts_with(b"HTTP/1.0 200");
    if !status_ok {
        return Err("aria2 RPC returned non-200 status".to_string());
    }
    Ok(&raw[header_end..])
}

fn call_aria2_rpc(host: &str, port: u16, body: &Value) -> Result<Value, String> {
    let normalized_host = host.trim().trim_start_matches('[').trim_end_matches(']');
    if normalized_host.is_empty() {
        return Err("Invalid RPC host".to_string());
    }

    let mut stream = TcpStream::connect((normalized_host, port))
        .map_err(|e| format!("RPC connect failed: {e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(60)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(60)))
        .map_err(|e| e.to_string())?;

    let payload = serde_json::to_vec(body).map_err(|e| e.to_string())?;
    let request = format!(
        "POST /jsonrpc HTTP/1.1\r\nHost: {host}:{port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        payload.len()
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("RPC write failed: {e}"))?;
    stream
        .write_all(&payload)
        .map_err(|e| format!("RPC write failed: {e}"))?;
    stream
        .flush()
        .map_err(|e| format!("RPC flush failed: {e}"))?;

    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|e| format!("RPC read failed: {e}"))?;

    let body_bytes = split_http_response(&response)?;
    serde_json::from_slice::<Value>(body_bytes).map_err(|e| format!("Invalid RPC JSON: {e}"))
}

fn should_retry_add_torrent_rpc(error: &str) -> bool {
    let normalized = error.to_ascii_lowercase();
    normalized.contains("connection reset by peer")
        || normalized.contains("broken pipe")
        || normalized.contains("connection aborted")
}

fn parse_add_torrent_response(response: Value) -> Result<String, String> {
    if let Some(error) = response.get("error") {
        let message = error
            .get("message")
            .and_then(|value| value.as_str())
            .unwrap_or("task.new-task-fail");
        return Err(message.to_string());
    }

    response
        .get("result")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .ok_or_else(|| "task.new-task-fail".to_string())
}

#[tauri::command]
pub async fn restart_engine(handle: AppHandle) -> Result<(), String> {
    crate::engine::restart_engine(&handle)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_engine_status(state: tauri::State<'_, crate::state::AppState>) -> Result<bool, String> {
    let running = state.engine_running.lock().map_err(|e| e.to_string())?;
    Ok(*running)
}

#[tauri::command]
pub async fn add_torrent_by_path(
    handle: AppHandle,
    state: tauri::State<'_, crate::state::AppState>,
    path: String,
    options: Option<Value>,
) -> Result<String, String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("task.new-task-torrent-required".to_string());
    }

    let fs_path = Path::new(path);
    let is_torrent = fs_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("torrent"))
        == Some(true);
    if !is_torrent {
        return Err("task.new-task-torrent-required".to_string());
    }

    let bytes = std::fs::read(fs_path).map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("Torrent payload is empty".to_string());
    }
    let fallback_name = fs_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("download");
    let (is_multi_file, torrent_root_name) =
        crate::commands::file_cmds::inspect_torrent_metadata(&bytes, fallback_name)
            .unwrap_or_else(|_| (false, fallback_name.to_string()));

    let (host, port, secret) = resolve_rpc_endpoint(&state)?;
    let mut params = Vec::new();
    if !secret.is_empty() {
        params.push(Value::String(format!("token:{secret}")));
    }

    params.push(Value::String(encode_base64(&bytes)));
    params.push(Value::Array(Vec::new()));

    let options = options.unwrap_or(Value::Object(Map::new()));
    let mut options = match options {
        Value::Object(map) => map,
        _ => Map::new(),
    };
    if is_multi_file {
        options.remove("out");
    } else {
        let has_out = options
            .get("out")
            .and_then(|value| value.as_str())
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);

        if !has_out {
            options.insert(
                "out".to_string(),
                Value::String(format!("{}{}", torrent_root_name, TEMP_DOWNLOAD_SUFFIX)),
            );
        } else if let Some(current_out) = options.get("out").and_then(|value| value.as_str()) {
            let trimmed = current_out.trim();
            if !trimmed.to_ascii_lowercase().ends_with(TEMP_DOWNLOAD_SUFFIX) {
                options.insert(
                    "out".to_string(),
                    Value::String(format!("{}{}", trimmed, TEMP_DOWNLOAD_SUFFIX)),
                );
            }
        }
    }
    let options = Value::Object(options);
    params.push(options);

    let payload = json!({
        "jsonrpc": "2.0",
        "id": "motrix-tauri",
        "method": "aria2.addTorrent",
        "params": params,
    });

    let mut retried_after_restart = false;
    loop {
        let host_for_call = host.clone();
        let payload_for_call = payload.clone();
        let rpc_result =
            spawn_blocking(move || call_aria2_rpc(&host_for_call, port, &payload_for_call))
                .await
                .map_err(|e| format!("RPC task failed: {e}"))?;
        match rpc_result {
            Ok(response) => return parse_add_torrent_response(response),
            Err(err) => {
                if retried_after_restart || !should_retry_add_torrent_rpc(&err) {
                    return Err(err);
                }
                retried_after_restart = true;
                crate::engine::restart_engine(&handle)
                    .await
                    .map_err(|e| e.to_string())?;
                sleep(Duration::from_millis(500)).await;
            }
        }
    }
}
