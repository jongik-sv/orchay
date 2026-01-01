use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub status: String,
    pub wbs_depth: Option<u32>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub wbs_depth: Option<u32>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListResponse {
    pub projects: Vec<ProjectListItem>,
    pub default_project: Option<String>,
    pub total: usize,
}

/// 프로젝트 목록 조회 (projects/ 폴더 스캔)
#[tauri::command]
pub async fn get_projects(
    base_path: String,
    status_filter: Option<String>,
) -> Result<ProjectListResponse, String> {
    let projects_path = PathBuf::from(&base_path)
        .join(".orchay")
        .join("projects");

    if !projects_path.exists() {
        return Ok(ProjectListResponse {
            projects: vec![],
            default_project: None,
            total: 0,
        });
    }

    let mut projects: Vec<ProjectListItem> = Vec::new();

    let entries = fs::read_dir(&projects_path).map_err(|e| format!("Failed to read dir: {}", e))?;

    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }

        let project_id = entry.file_name().to_string_lossy().to_string();
        let project_json_path = entry.path().join("project.json");

        if let Ok(content) = fs::read_to_string(&project_json_path) {
            if let Ok(config) = serde_json::from_str::<ProjectConfig>(&content) {
                let status = config.status.unwrap_or_else(|| "active".to_string());

                // 필터 적용
                if let Some(ref filter) = status_filter {
                    if &status != filter {
                        continue;
                    }
                }

                projects.push(ProjectListItem {
                    id: config.id,
                    name: config.name,
                    path: project_id,
                    status,
                    wbs_depth: config.wbs_depth.or(Some(4)),
                    created_at: config.created_at,
                });
            }
        }
    }

    // 생성일 기준 정렬 (최신순)
    projects.sort_by(|a, b| {
        let a_date = a.created_at.as_deref().unwrap_or("");
        let b_date = b.created_at.as_deref().unwrap_or("");
        b_date.cmp(a_date)
    });

    let total = projects.len();

    Ok(ProjectListResponse {
        projects,
        default_project: None,
        total,
    })
}

/// 단일 프로젝트 조회
#[tauri::command]
pub async fn get_project(base_path: String, project_id: String) -> Result<ProjectConfig, String> {
    let project_json_path = PathBuf::from(&base_path)
        .join(".orchay")
        .join("projects")
        .join(&project_id)
        .join("project.json");

    let content = fs::read_to_string(&project_json_path)
        .map_err(|_| format!("Project not found: {}", project_id))?;

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse project.json: {}", e))
}

/// WBS 파일 조회
#[tauri::command]
pub async fn get_wbs(base_path: String, project_id: String) -> Result<String, String> {
    let wbs_path = PathBuf::from(&base_path)
        .join(".orchay")
        .join("projects")
        .join(&project_id)
        .join("wbs.md");

    fs::read_to_string(&wbs_path).map_err(|_| format!("WBS not found for project: {}", project_id))
}

/// WBS 파일 저장
#[tauri::command]
pub async fn put_wbs(
    base_path: String,
    project_id: String,
    content: String,
) -> Result<bool, String> {
    let wbs_path = PathBuf::from(&base_path)
        .join(".orchay")
        .join("projects")
        .join(&project_id)
        .join("wbs.md");

    // 부모 디렉토리 확인
    if let Some(parent) = wbs_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
        }
    }

    fs::write(&wbs_path, content).map_err(|e| format!("Failed to write WBS: {}", e))?;
    Ok(true)
}

/// 설정 파일 조회
#[tauri::command]
pub async fn get_settings(
    base_path: String,
    setting_type: String,
) -> Result<serde_json::Value, String> {
    let settings_path = PathBuf::from(&base_path)
        .join(".orchay")
        .join("settings")
        .join(format!("{}.json", setting_type));

    let content = fs::read_to_string(&settings_path)
        .map_err(|_| format!("Settings not found: {}", setting_type))?;

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
}
