use std::sync::Arc;

use app_core::{CachePaths, SetupFolders};
use serde::Deserialize;
use serde_json::Value;

use crate::commands::{ApiError, CmdResult};
use crate::events::EventBus;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkipSetupArgs {
    #[serde(default)]
    ffmpeg_path: Option<String>,
    #[serde(default)]
    python_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TriggerSetupArgs {
    #[serde(default)]
    data_path: Option<String>,
    #[serde(default)]
    cache_paths: Option<CachePaths>,
}

pub fn trigger_setup(events: Arc<EventBus>, payload: Value) -> CmdResult {
    let args: TriggerSetupArgs = if payload.is_null() {
        TriggerSetupArgs {
            data_path: None,
            cache_paths: None,
        }
    } else {
        serde_json::from_value(payload)
            .map_err(|e| ApiError::bad_request(format!("invalid trigger_setup args: {e}")))?
    };

    let events_clone = events.clone();
    std::thread::spawn(move || {
        let events_for_progress = events_clone.clone();
        if let Err(e) = app_core::run_vendor_setup(
            SetupFolders {
                data_path: args.data_path,
                cache_paths: args.cache_paths,
            },
            move |progress| {
                events_for_progress.emit("setup-progress", &progress);
            },
            |_| Ok(()),
        ) {
            events_clone.emit_value("setup-error", serde_json::Value::String(e));
        }
    });
    Ok(Value::Null)
}

pub fn skip_setup(events: Arc<EventBus>, payload: Value) -> CmdResult {
    let args: SkipSetupArgs = if payload.is_null() {
        SkipSetupArgs {
            ffmpeg_path: None,
            python_path: None,
        }
    } else {
        serde_json::from_value(payload)
            .map_err(|e| ApiError::bad_request(format!("invalid skip_setup args: {e}")))?
    };

    let events_clone = events.clone();
    std::thread::spawn(move || {
        let user_ffmpeg = args.ffmpeg_path.map(std::path::PathBuf::from);
        let user_python = args.python_path.map(std::path::PathBuf::from);

        if let Err(e) = app_core::skip_vendor_setup(user_ffmpeg, user_python) {
            events_clone.emit_value("setup-error", serde_json::Value::String(e));
            return;
        }

        events_clone.emit(
            "setup-progress",
            &app_core::SetupProgress {
                step: app_core::SetupStep::Finish,
                percent: 100,
                action: "Done".to_string(),
            },
        );
    });
    Ok(Value::Null)
}
