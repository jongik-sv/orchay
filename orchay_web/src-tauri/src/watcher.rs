//! WBS 파일 변경 감시 모듈
//! .orchay/projects/*/wbs.yaml 파일 변경을 감지하여 프론트엔드에 이벤트 발행

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use once_cell::sync::Lazy;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// 전역 watcher 실행 상태
static IS_WATCHING: AtomicBool = AtomicBool::new(false);

/// 전역 watcher 중지 플래그
static STOP_FLAG: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

/// WBS 변경 이벤트 페이로드
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WbsChangedPayload {
    pub project_id: String,
    pub path: String,
    pub timestamp: String,
}

/// 경로에서 프로젝트 ID 추출
/// .orchay/projects/{project_id}/wbs.yaml → project_id
fn extract_project_id(path: &PathBuf, projects_path: &PathBuf) -> Option<String> {
    let relative = path.strip_prefix(projects_path).ok()?;
    let components: Vec<_> = relative.components().collect();
    if !components.is_empty() {
        Some(components[0].as_os_str().to_string_lossy().to_string())
    } else {
        None
    }
}

/// WBS 파일 변경 감시 시작
/// .orchay/projects/*/wbs.yaml 패턴 감시
fn start_wbs_watcher_internal(app_handle: AppHandle, base_path: String) {
    let projects_path = PathBuf::from(&base_path)
        .join(".orchay")
        .join("projects");

    if !projects_path.exists() {
        eprintln!("[Watcher] Projects path does not exist: {:?}", projects_path);
        return;
    }

    println!("[Watcher] Starting watch on: {:?}", projects_path);

    let (tx, rx) = mpsc::channel();

    // 300ms debounce로 디바운서 생성
    let mut debouncer = match new_debouncer(Duration::from_millis(300), tx) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[Watcher] Failed to create debouncer: {}", e);
            return;
        }
    };

    // 모든 프로젝트 폴더 재귀 감시
    if let Err(e) = debouncer.watcher().watch(&projects_path, RecursiveMode::Recursive) {
        eprintln!("[Watcher] Failed to watch path: {}", e);
        return;
    }

    IS_WATCHING.store(true, Ordering::SeqCst);

    // 이벤트 루프
    loop {
        // 중지 플래그 확인
        if let Ok(stop) = STOP_FLAG.lock() {
            if *stop {
                println!("[Watcher] Stop flag detected, exiting...");
                break;
            }
        }

        // 100ms 타임아웃으로 이벤트 수신 (중지 플래그 확인을 위해)
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(Ok(events)) => {
                for event in events {
                    if let Some(path_str) = event.path.to_str() {
                        // wbs.yaml 파일만 처리
                        if path_str.ends_with("wbs.yaml") {
                            // 쓰기 완료 이벤트만 처리
                            if matches!(event.kind, DebouncedEventKind::Any) {
                                // 프로젝트 ID 추출
                                if let Some(project_id) = extract_project_id(&event.path, &projects_path) {
                                    let payload = WbsChangedPayload {
                                        project_id: project_id.clone(),
                                        path: path_str.to_string(),
                                        timestamp: chrono::Utc::now().to_rfc3339(),
                                    };

                                    println!("[Watcher] WBS changed: {} -> {}", project_id, path_str);

                                    // 프론트엔드로 이벤트 발행
                                    if let Err(e) = app_handle.emit("wbs-changed", payload) {
                                        eprintln!("[Watcher] Failed to emit event: {}", e);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(Err(e)) => {
                eprintln!("[Watcher] Watch error: {:?}", e);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // 타임아웃 - 정상, 루프 계속
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                eprintln!("[Watcher] Channel disconnected");
                break;
            }
        }
    }

    IS_WATCHING.store(false, Ordering::SeqCst);
    println!("[Watcher] Watcher stopped");
}

/// WBS Watcher 시작 커맨드
#[tauri::command]
pub async fn start_watching(app_handle: AppHandle, base_path: String) -> Result<bool, String> {
    // 이미 실행 중이면 false 반환
    if IS_WATCHING.load(Ordering::SeqCst) {
        println!("[Watcher] Already watching");
        return Ok(false);
    }

    // 중지 플래그 리셋
    if let Ok(mut stop) = STOP_FLAG.lock() {
        *stop = false;
    }

    let app_clone = app_handle.clone();
    let path_clone = base_path.clone();

    // 별도 스레드에서 watcher 실행
    std::thread::spawn(move || {
        start_wbs_watcher_internal(app_clone, path_clone);
    });

    println!("[Watcher] Watch started for: {}", base_path);
    Ok(true)
}

/// WBS Watcher 중지 커맨드
#[tauri::command]
pub async fn stop_watching() -> Result<bool, String> {
    if !IS_WATCHING.load(Ordering::SeqCst) {
        println!("[Watcher] Not watching");
        return Ok(false);
    }

    // 중지 플래그 설정
    if let Ok(mut stop) = STOP_FLAG.lock() {
        *stop = true;
    }

    println!("[Watcher] Stop requested");
    Ok(true)
}

/// Watcher 실행 상태 확인
#[tauri::command]
pub async fn is_watching() -> Result<bool, String> {
    Ok(IS_WATCHING.load(Ordering::SeqCst))
}
