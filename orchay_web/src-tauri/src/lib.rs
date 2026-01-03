mod commands;
mod watcher;

use commands::{config, files, projects};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // Config
            config::select_directory,
            config::get_base_path,
            config::set_base_path,
            config::get_recent_paths,
            config::toggle_devtools,
            // Files
            files::check_init_status,
            files::ensure_orchay_structure,
            files::read_file_content,
            files::read_file_content_base64,
            files::write_file_content,
            files::list_task_documents,
            // Projects
            projects::get_projects,
            projects::get_project,
            projects::get_wbs,
            projects::put_wbs,
            projects::get_settings,
            projects::list_project_files,
            // Watcher
            watcher::start_watching,
            watcher::stop_watching,
            watcher::is_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
