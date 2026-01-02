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
    pub description: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub wbs_depth: Option<u32>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub scheduled_start: Option<String>,
    #[serde(default)]
    pub scheduled_end: Option<String>,
}

/// WBS 설정 (wbs.yaml의 wbs 섹션)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WbsConfig {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub depth: Option<u32>,
    #[serde(default)]
    pub project_root: Option<String>,
    #[serde(default)]
    pub strategy: Option<String>,
}

/// WBS YAML 전체 구조
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WbsYaml {
    pub project: ProjectConfig,
    #[serde(default)]
    pub wbs: Option<WbsConfig>,
    #[serde(default)]
    pub work_packages: Option<serde_yaml::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListResponse {
    pub projects: Vec<ProjectListItem>,
    pub default_project: Option<String>,
    pub total: usize,
}

/// 프로젝트 목록 조회 (projects/ 폴더 스캔, wbs.yaml 읽기)
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
        let wbs_yaml_path = entry.path().join("wbs.yaml");

        if let Ok(content) = fs::read_to_string(&wbs_yaml_path) {
            if let Ok(wbs_yaml) = serde_yaml::from_str::<WbsYaml>(&content) {
                let config = wbs_yaml.project;
                let status = config.status.unwrap_or_else(|| "active".to_string());

                // 필터 적용
                if let Some(ref filter) = status_filter {
                    if &status != filter {
                        continue;
                    }
                }

                // wbsDepth: project.wbsDepth 또는 wbs.depth 또는 기본값 3
                let wbs_depth = config.wbs_depth
                    .or_else(|| wbs_yaml.wbs.as_ref().and_then(|w| w.depth))
                    .or(Some(3));

                projects.push(ProjectListItem {
                    id: config.id,
                    name: config.name,
                    path: project_id,
                    status,
                    wbs_depth,
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

/// 단일 프로젝트 조회 (wbs.yaml의 project 섹션)
#[tauri::command]
pub async fn get_project(base_path: String, project_id: String) -> Result<ProjectConfig, String> {
    let wbs_yaml_path = PathBuf::from(&base_path)
        .join(".orchay")
        .join("projects")
        .join(&project_id)
        .join("wbs.yaml");

    let content = fs::read_to_string(&wbs_yaml_path)
        .map_err(|_| format!("Project not found: {}", project_id))?;

    let wbs_yaml: WbsYaml = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse wbs.yaml: {}", e))?;

    Ok(wbs_yaml.project)
}

/// WBS 파일 조회 (wbs.yaml 전체)
#[tauri::command]
pub async fn get_wbs(base_path: String, project_id: String) -> Result<String, String> {
    let wbs_path = PathBuf::from(&base_path)
        .join(".orchay")
        .join("projects")
        .join(&project_id)
        .join("wbs.yaml");

    fs::read_to_string(&wbs_path).map_err(|_| format!("WBS not found for project: {}", project_id))
}

/// WBS 파일 저장 (wbs.yaml)
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
        .join("wbs.yaml");

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
