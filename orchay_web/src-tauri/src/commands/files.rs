use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct OrchayStructure {
    pub root: bool,
    pub settings: bool,
    pub templates: bool,
    pub projects: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitResponse {
    pub success: bool,
    pub data: InitStatusData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InitStatusData {
    pub initialized: bool,
    pub status: OrchayStructure,
}

/// .orchay 디렉토리 구조 확인
fn check_orchay_structure(base_path: &str) -> OrchayStructure {
    let base = PathBuf::from(base_path);
    let orchay_root = base.join(".orchay");

    OrchayStructure {
        root: orchay_root.exists() && orchay_root.is_dir(),
        settings: orchay_root.join("settings").is_dir(),
        templates: orchay_root.join("templates").is_dir(),
        projects: orchay_root.join("projects").is_dir(),
    }
}

/// GET /api/init 대체
#[tauri::command]
pub async fn check_init_status(base_path: String) -> Result<InitResponse, String> {
    let structure = check_orchay_structure(&base_path);
    let initialized = structure.root && structure.settings && structure.projects;

    Ok(InitResponse {
        success: true,
        data: InitStatusData {
            initialized,
            status: structure,
        },
    })
}

/// .orchay 구조 생성
#[tauri::command]
pub async fn ensure_orchay_structure(base_path: String) -> Result<InitResponse, String> {
    let base = PathBuf::from(&base_path);
    let orchay_root = base.join(".orchay");

    let dirs = vec![
        orchay_root.clone(),
        orchay_root.join("settings"),
        orchay_root.join("templates"),
        orchay_root.join("projects"),
    ];

    for dir in dirs {
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create dir: {}", e))?;
        }
    }

    let structure = check_orchay_structure(&base_path);
    let initialized = structure.root && structure.settings && structure.projects;

    Ok(InitResponse {
        success: true,
        data: InitStatusData {
            initialized,
            status: structure,
        },
    })
}

/// 파일 읽기 (텍스트)
#[tauri::command]
pub async fn read_file_content(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))
}

/// 파일 읽기 (바이너리 → Base64)
/// 이미지 등 바이너리 파일을 Base64로 인코딩하여 반환
#[tauri::command]
pub async fn read_file_content_base64(file_path: String) -> Result<String, String> {
    let bytes = fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(BASE64.encode(&bytes))
}

/// 파일 쓰기
#[tauri::command]
pub async fn write_file_content(file_path: String, content: String) -> Result<bool, String> {
    // 부모 디렉토리 생성
    if let Some(parent) = PathBuf::from(&file_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
        }
    }

    fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(true)
}

// ============================================================
// Task Documents API
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentInfo {
    pub name: String,
    pub path: String,
    pub exists: bool,
    #[serde(rename = "type")]
    pub doc_type: String,
    pub stage: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

/// 문서 타입 결정 (서버 로직과 동일)
fn determine_doc_type(filename: &str) -> String {
    if filename.contains("basic-design") || filename.contains("기본설계") {
        "design".to_string()
    } else if filename.contains("detail-design") || filename.contains("상세설계") {
        "design".to_string()
    } else if filename.contains("implementation") {
        "implementation".to_string()
    } else if filename.contains("integration-test") {
        "test".to_string()
    } else if filename.contains("manual") {
        "manual".to_string()
    } else if filename.contains("prd") || filename.contains("요구사항") {
        "prd".to_string()
    } else if filename.contains("review") {
        "review".to_string()
    } else {
        "design".to_string()
    }
}

/// SystemTime을 ISO8601 문자열로 변환
fn system_time_to_iso(time: SystemTime) -> Option<String> {
    let datetime: DateTime<Utc> = time.into();
    Some(datetime.to_rfc3339())
}

/// Task 문서 목록 조회
/// 서버의 buildDocumentInfoList()와 동일한 기능
#[tauri::command]
pub async fn list_task_documents(
    base_path: String,
    project_id: String,
    task_id: String,
) -> Result<Vec<DocumentInfo>, String> {
    let task_folder = PathBuf::from(&base_path)
        .join(".orchay")
        .join("projects")
        .join(&project_id)
        .join("tasks")
        .join(&task_id);

    // 폴더가 없으면 빈 배열 반환
    if !task_folder.exists() || !task_folder.is_dir() {
        return Ok(vec![]);
    }

    let mut documents: Vec<DocumentInfo> = vec![];

    let entries = fs::read_dir(&task_folder)
        .map_err(|e| format!("Failed to read task folder: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // .md 파일만 처리
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    if let Some(filename) = path.file_name() {
                        let name = filename.to_string_lossy().to_string();
                        let doc_type = determine_doc_type(&name);

                        // 메타데이터 조회
                        let metadata = fs::metadata(&path).ok();
                        let (size, created_at, updated_at) = if let Some(meta) = metadata {
                            (
                                Some(meta.len()),
                                meta.created().ok().and_then(system_time_to_iso),
                                meta.modified().ok().and_then(system_time_to_iso),
                            )
                        } else {
                            (None, None, None)
                        };

                        documents.push(DocumentInfo {
                            name: name.clone(),
                            path: format!("tasks/{}/{}", task_id, name),
                            exists: true,
                            doc_type,
                            stage: "current".to_string(),
                            size,
                            created_at,
                            updated_at,
                        });
                    }
                }
            }
        }
    }

    // 이름순 정렬
    documents.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(documents)
}
