use app_core::{
    is_manual_mode as app_is_manual_mode, is_ready as is_vendor_ready, run_vendor_setup,
    ManualVendorConfig,
};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub fn trigger_setup(app: AppHandle, data_path: Option<String>) {
    std::thread::spawn(move || {
        let app_for_progress = app.clone();
        let app_for_migration = app.clone();
        if let Err(e) = run_vendor_setup(
            data_path,
            move |progress| {
                let _ = app_for_progress.emit("setup-progress", progress);
            },
            move |new_path| {
                app_for_migration
                    .asset_protocol_scope()
                    .allow_directory(new_path, true)
                    .map_err(|e| {
                        format!(
                            "Failed to update asset protocol scope for migrated data path {:?}: {e}",
                            new_path
                        )
                    })
            },
        ) {
            let _ = app.emit("setup-error", e);
        }
    });
}

#[tauri::command]
pub fn is_ready() -> bool {
    is_vendor_ready()
}

// ─── Manual Mode Commands ─────────────────────────────────────────────

#[tauri::command]
pub fn get_manual_config() -> ManualVendorConfig {
    app_core::load_manual_config()
}

#[tauri::command]
pub fn save_manual_config_command(config: ManualVendorConfig) -> Result<(), String> {
    app_core::save_manual_config(&config)
}

#[tauri::command]
pub fn is_manual_mode() -> bool {
    app_is_manual_mode()
}

#[tauri::command]
pub fn validate_manual_setup_command(config: ManualVendorConfig) -> Result<Vec<String>, String> {
    app_core::validate_manual_setup(&config)
}

#[tauri::command]
pub fn complete_manual_setup_command(config: ManualVendorConfig) -> Result<Vec<String>, String> {
    app_core::complete_manual_setup(&config)
}
