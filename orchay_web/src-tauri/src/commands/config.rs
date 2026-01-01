use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct SetBasePathResult {
    pub success: bool,
    pub previous_path: String,
    pub current_path: String,
}

/// 디렉토리 선택 다이얼로그
#[tauri::command]
pub async fn select_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let result = app
        .dialog()
        .file()
        .set_title("Orchay 프로젝트 폴더 선택")
        .blocking_pick_folder();

    match result {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

/// 현재 base_path 조회
#[tauri::command]
pub async fn get_base_path(app: AppHandle) -> Result<String, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;

    if let Some(path) = store.get("base_path") {
        if let Some(s) = path.as_str() {
            return Ok(s.to_string());
        }
    }

    // 기본값: 홈 디렉토리
    Ok(dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string()))
}

/// base_path 설정 및 저장
#[tauri::command]
pub async fn set_base_path(app: AppHandle, new_path: String) -> Result<SetBasePathResult, String> {
    // 경로 검증
    let path = PathBuf::from(&new_path);
    if !path.exists() {
        return Err(format!("디렉토리를 찾을 수 없습니다: {}", new_path));
    }
    if !path.is_dir() {
        return Err("유효한 디렉토리가 아닙니다".to_string());
    }

    let store = app.store("config.json").map_err(|e| e.to_string())?;

    // 이전 경로 저장
    let previous = store
        .get("base_path")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_default();

    // 최근 경로 업데이트
    let mut recent: Vec<String> = store
        .get("recent_paths")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    recent.retain(|p| p != &new_path);
    recent.insert(0, new_path.clone());
    recent.truncate(5);

    // 저장
    store.set("base_path", serde_json::json!(new_path));
    store.set("recent_paths", serde_json::json!(recent));
    store.save().map_err(|e| e.to_string())?;

    Ok(SetBasePathResult {
        success: true,
        previous_path: previous,
        current_path: new_path,
    })
}

/// 최근 경로 목록 조회
#[tauri::command]
pub async fn get_recent_paths(app: AppHandle) -> Result<Vec<String>, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;

    Ok(store
        .get("recent_paths")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default())
}

/// DevTools 토글
#[tauri::command]
pub async fn toggle_devtools(window: tauri::WebviewWindow) {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
}
