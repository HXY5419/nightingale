import { invoke, listen } from "./runtime";
import type { SetupProgress } from "@/types/SetupProgress";

export const isAppReady = async (): Promise<boolean> => {
  return await invoke<boolean>("is_ready");
};

export const triggerSetup = async (dataFolder?: string): Promise<void> => {
  return await invoke<void>("trigger_setup", { dataPath: dataFolder });
};

export const onSetupProgress = async (
  cb: (progress: SetupProgress) => void,
): Promise<() => void> => {
  return await listen<SetupProgress>("setup-progress", ({ payload }) => cb(payload));
};

export const onSetupError = async (cb: (error: string) => void): Promise<() => void> => {
  return await listen<string>("setup-error", ({ payload }) => cb(payload));
};

// ─── Manual Mode ─────────────────────────────────────────────────────

export interface ManualVendorConfig {
  enabled: boolean;
  /** Custom path to ffmpeg binary */
  ffmpeg_path?: string | null;
  /** Custom path to Python 3.10 binary */
  python_path?: string | null;
  /** CUDA variant: "cpu", "cu126", or "cu128" */
  cuda_version?: string | null;
  /** Skip video background pre-download */
  skip_videos: boolean;
}

export const getManualConfig = async (): Promise<ManualVendorConfig> => {
  return await invoke<ManualVendorConfig>("get_manual_config");
};

export const saveManualConfig = async (config: ManualVendorConfig): Promise<void> => {
  return await invoke<void>("save_manual_config_command", { config });
};

export const isManualMode = async (): Promise<boolean> => {
  return await invoke<boolean>("is_manual_mode");
};

export const validateManualSetup = async (
  config: ManualVendorConfig,
): Promise<string[]> => {
  return await invoke<string[]>("validate_manual_setup_command", { config });
};

export const completeManualSetup = async (
  config: ManualVendorConfig,
): Promise<string[]> => {
  return await invoke<string[]>("complete_manual_setup_command", { config });
};
