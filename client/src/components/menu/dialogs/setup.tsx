import {
  completeManualSetup,
  onSetupError,
  onSetupProgress,
  triggerSetup,
  type ManualVendorConfig,
} from "@/bridge/setup";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavInput } from "@/hooks/navigation/use-nav-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exit, EXIT_SUPPORTED } from "@/bridge/exit";
import { Progress } from "@/components/ui/progress";
import type { SetupProgress } from "@/types/SetupProgress";
import type { SetupStep } from "@/types/SetupStep";
import logoSrc from "@/assets/images/logo_square.png";
import { useShouldRunSetup } from "@/hooks/use-should-run-setup";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { selectFolderPath } from "@/bridge/source";
import { useConfig } from "@/queries/use-config";
import { ANALYSIS_QUEUE, CONFIG, MENU, SONGS, SONGS_META } from "@/queries/keys";
import { useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isTauri } from "@/bridge/runtime";

interface ExtendedSetupProgress extends Omit<SetupProgress, "step"> {
  step: SetupStep | "init" | "manual" | "manualconfig" | "error" | "changedatafolder";
}

type SetupMode = "auto" | "manual" | null;

type InitialStepProps = {
  onSelectAuto: () => void;
  onSelectManual: () => void;
};

const InitialStep = ({ onSelectAuto, onSelectManual }: InitialStepProps) => {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Welcome to Nightingale!</AlertDialogTitle>
        <AlertDialogDescription>
          Before you get started, Nightingale needs a few components for AI-powered audio analysis:
          {" "}<code>ffmpeg</code>, <code>Python 3.10</code>, and several Python packages for
          {" "}vocal separation, transcription, and key detection.
        </AlertDialogDescription>
        <AlertDialogDescription className="mt-2">
          Choose how to set up these dependencies:
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
        <AlertDialogAction onClick={onSelectAuto} className="w-full">
          Automatic Setup (Recommended)
        </AlertDialogAction>
        <Button variant="outline" onClick={onSelectManual} className="w-full">
          Manual Setup — I'll provide the dependencies myself
        </Button>
        {EXIT_SUPPORTED && (
          <AlertDialogCancel onClick={() => exit()} className="w-full">
            Exit
          </AlertDialogCancel>
        )}
      </AlertDialogFooter>
    </>
  );
};

type ChangeDataStepProps = {
  onStart: () => Promise<void>;
  folder?: string;
  setFolder: (folder?: string) => void;
};

const ChangeDataFolderStep = ({ onStart, folder, setFolder }: ChangeDataStepProps) => (
  <>
    <AlertDialogHeader>
      <AlertDialogTitle>Data Folder</AlertDialogTitle>
      <>
        <AlertDialogDescription className="mb-2">
          Choose where Nightingale stores app data. We will store cache, videos, models, vendor
          tools, and the library database in this folder. Only <code>config.json</code> and{" "}
          <code>nightingale.log</code> stay in the default <code>~/.nightingale</code> path.
        </AlertDialogDescription>
        <div className="flex gap-2 w-full">
          <Input value={folder ?? ""} disabled />
          <Button
            variant="outline"
            onClick={async () => {
              const f = await selectFolderPath();
              if (!f) return;
              setFolder(f);
            }}
          >
            {folder ? "Change Folder" : "Choose Folder"}
          </Button>
        </div>
      </>
    </AlertDialogHeader>
    <AlertDialogFooter>
      {EXIT_SUPPORTED && <AlertDialogCancel onClick={() => exit()}>Exit</AlertDialogCancel>}
      <AlertDialogAction onClick={onStart}>Continue</AlertDialogAction>
    </AlertDialogFooter>
  </>
);

interface ManualConfigStepProps {
  config: ManualVendorConfig;
  onChange: (config: ManualVendorConfig) => void;
  onBack: () => void;
  onComplete: () => Promise<void>;
  validating: boolean;
}

const ManualConfigStep = ({
  config,
  onChange,
  onBack,
  onComplete,
  validating,
}: ManualConfigStepProps) => {
  const [error, setError] = useState<string | null>(null);

  const pickFile = async (key: "ffmpeg_path" | "python_path") => {
    if (!isTauri) {
      const input = window.prompt(
        key === "ffmpeg_path" ? "Full path to ffmpeg executable:" : "Full path to Python 3.10 executable:",
        key === "ffmpeg_path" ? "/usr/bin/ffmpeg" : "/usr/bin/python3.10",
      );
      if (!input) return;
      const trimmed = input.trim();
      if (trimmed) {
        onChange({ ...config, [key]: trimmed });
      }
      return;
    }
    const selected = await open({ multiple: false });
    if (selected) {
      onChange({ ...config, [key]: selected });
    }
  };

  const handleComplete = async () => {
    setError(null);
    try {
      await onComplete();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Manual Dependency Setup</AlertDialogTitle>
        <AlertDialogDescription>
          Provide the paths to your existing installations. All fields are optional, but the
          analyzer will not work without both ffmpeg and Python 3.10.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex flex-col gap-4 px-1">
        {/* FFmpeg */}
        <div className="flex flex-col gap-1.5">
          <Label>FFmpeg</Label>
          <div className="flex gap-2">
            <Input
              value={config.ffmpeg_path ?? ""}
              placeholder="e.g. /usr/bin/ffmpeg or C:\ffmpeg\bin\ffmpeg.exe"
              onChange={(e) => onChange({ ...config, ffmpeg_path: e.target.value || null })}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => pickFile("ffmpeg_path")}>
              Browse
            </Button>
          </div>
        </div>

        {/* Python */}
        <div className="flex flex-col gap-1.5">
          <Label>Python 3.10</Label>
          <div className="flex gap-2">
            <Input
              value={config.python_path ?? ""}
              placeholder="e.g. /usr/bin/python3.10 or C:\Python310\python.exe"
              onChange={(e) => onChange({ ...config, python_path: e.target.value || null })}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => pickFile("python_path")}>
              Browse
            </Button>
          </div>
        </div>

        {/* CUDA Version */}
        <div className="flex flex-col gap-1.5">
          <Label>CUDA / GPU Acceleration</Label>
          <Select
            value={config.cuda_version ?? ""}
            onValueChange={(val) =>
              onChange({ ...config, cuda_version: val || null })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Auto-detect (default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Auto-detect (default)</SelectItem>
              <SelectItem value="cpu">CPU Only (no GPU)</SelectItem>
              <SelectItem value="cu126">CUDA 12.6 (NVIDIA, compute cap &lt; 10)</SelectItem>
              <SelectItem value="cu128">CUDA 12.8 (NVIDIA, compute cap ≥ 10)</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialogDescription className="text-xs mt-1">
            Choose CPU if you don't have an NVIDIA GPU. CUDA 12.6 works on most NVIDIA GPUs; CUDA 12.8 is for RTX 40-series and newer.
          </AlertDialogDescription>
        </div>

        {/* Skip videos */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="skip-videos"
            checked={config.skip_videos}
            onChange={(e) => onChange({ ...config, skip_videos: e.target.checked })}
            className="size-4 rounded border border-input"
          />
          <Label htmlFor="skip-videos">Skip video background pre-download</Label>
        </div>

        {error && (
          <AlertDialogDescription className="text-destructive text-xs">
            {error}
          </AlertDialogDescription>
        )}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onBack}>Back</AlertDialogCancel>
        <AlertDialogAction onClick={handleComplete} disabled={validating}>
          {validating ? "Validating..." : "Complete Setup"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
};

interface LoadStepProps {
  action: string;
  percent: number;
}

const LoadStep = ({ action, percent }: LoadStepProps) => (
  <>
    <AlertDialogHeader>
      <AlertDialogTitle>Setting up Nightingale</AlertDialogTitle>
      <div className="flex flex-col gap-2 w-full">
        <AlertDialogDescription className="w-full">{action}</AlertDialogDescription>
        <Progress value={percent} />
      </div>
    </AlertDialogHeader>
    {EXIT_SUPPORTED && (
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => exit()}>Exit</AlertDialogCancel>
      </AlertDialogFooter>
    )}
  </>
);

interface ErrorStepProps {
  error: string;
  onExit?: () => void;
}

const ErrorStep = ({ error, onExit }: ErrorStepProps) => (
  <>
    <AlertDialogHeader>
      <AlertDialogTitle>Something went wrong</AlertDialogTitle>
      <AlertDialogDescription>
        <code>{error}</code>
      </AlertDialogDescription>
    </AlertDialogHeader>
    {EXIT_SUPPORTED && onExit && (
      <AlertDialogFooter>
        <AlertDialogAction onClick={onExit}>Exit</AlertDialogAction>
      </AlertDialogFooter>
    )}
  </>
);

interface FinalStepProps {
  onFinish: () => void;
  folder?: string;
  isManual: boolean;
  warnings?: string[];
}

const FinalStep = ({ onFinish, folder, isManual, warnings }: FinalStepProps) => (
  <>
    <AlertDialogHeader>
      <AlertDialogTitle>You're all set!</AlertDialogTitle>
      <AlertDialogDescription>
        {isManual
          ? "Your manually-configured dependencies have been registered. Nightingale is ready to use."
          : `All dependencies have been installed to ${folder}/vendor. Nightingale is ready to use.`}
      </AlertDialogDescription>
      {warnings && warnings.length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
          {warnings.map((w, i) => (
            <AlertDialogDescription key={i} className="text-yellow-500 text-xs">
              ⚠ {w}
            </AlertDialogDescription>
          ))}
        </div>
      )}
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogAction onClick={onFinish}>Get Started</AlertDialogAction>
    </AlertDialogFooter>
  </>
);

const defaultProgress = {
  step: "init" as const,
  percent: 0,
  action: "",
};

const defaultManualConfig: ManualVendorConfig = {
  enabled: false,
  ffmpeg_path: null,
  python_path: null,
  cuda_version: null,
  skip_videos: false,
};

export const Setup = () => {
  const { data: config } = useConfig();
  const { shouldRunSetup, setShouldRunSetup } = useShouldRunSetup();
  const queryClient = useQueryClient();

  const [overrideFolder, setOverrideFolder] = useState(config?.data_path);
  const [setupProgress, setSetupProgress] = useState<ExtendedSetupProgress>(defaultProgress);
  const [setupMode, setSetupMode] = useState<SetupMode>(null);
  const [manualConfig, setManualConfig] = useState<ManualVendorConfig>(defaultManualConfig);
  const [manualWarnings, setManualWarnings] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!overrideFolder && config?.data_path) {
      setOverrideFolder(config.data_path);
    }
  }, [config?.data_path, overrideFolder]);

  const invalidatePostSetupState = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: CONFIG }),
      queryClient.invalidateQueries({ queryKey: SONGS_META }),
      queryClient.invalidateQueries({ queryKey: SONGS }),
      queryClient.invalidateQueries({ queryKey: MENU }),
      queryClient.invalidateQueries({ queryKey: ANALYSIS_QUEUE }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    onSetupProgress((progress) => {
      setSetupProgress(progress);
      if (progress.step === "finish") {
        void invalidatePostSetupState();
      }
    }).then((fn) => {
      unlistenProgress = fn;
    });

    onSetupError((error) => {
      setSetupProgress({ step: "error", percent: 0, action: error });
    }).then((fn) => {
      unlistenError = fn;
    });

    return () => {
      unlistenProgress?.();
      unlistenError?.();
    };
  }, [invalidatePostSetupState]);

  const { step, percent, action } = setupProgress;

  const handleAutoSetup = useCallback(() => {
    setSetupMode("auto");
    setSetupProgress({ ...defaultProgress, step: "changedatafolder" });
  }, []);

  const handleManualSetup = useCallback(() => {
    setSetupMode("manual");
    setSetupProgress({ ...defaultProgress, step: "manualconfig" });
  }, []);

  const handleCompleteManual = useCallback(async () => {
    setValidating(true);
    try {
      const cfg = { ...manualConfig, enabled: true };
      const warnings = await completeManualSetup(cfg);
      setManualWarnings(warnings);
      await invalidatePostSetupState();
      setSetupProgress({ step: "finish", percent: 100, action: "Done" });
    } catch (e) {
      setSetupProgress({ step: "error", percent: 0, action: String(e) });
    } finally {
      setValidating(false);
    }
  }, [manualConfig, invalidatePostSetupState]);

  const handleFinish = useCallback(() => {
    void invalidatePostSetupState();
    setSetupProgress(defaultProgress);
    setSetupMode(null);
    setShouldRunSetup(false);
  }, [invalidatePostSetupState, setShouldRunSetup]);

  const handleExit = useCallback(() => {
    if (EXIT_SUPPORTED) exit();
  }, []);

  useNavInput(
    useCallback(
      (navAction) => {
        if (!shouldRunSetup) return;

        if (navAction.back) {
          if (step === "finish") {
            handleFinish();
          } else if (step === "manualconfig") {
            setSetupProgress(defaultProgress);
            setSetupMode(null);
          } else if (EXIT_SUPPORTED) {
            exit();
          }
          return;
        }

        if (navAction.confirm) {
          if (step === "init") {
            handleAutoSetup();
          } else if (step === "finish") {
            handleFinish();
          } else if (step === "error" && EXIT_SUPPORTED) {
            exit();
          }
        }
      },
      [handleAutoSetup, handleFinish, shouldRunSetup, step],
    ),
  );

  const Step = useMemo(() => {
    switch (step) {
      case "init":
        return () => (
          <InitialStep onSelectAuto={handleAutoSetup} onSelectManual={handleManualSetup} />
        );
      case "changedatafolder":
        return () => (
          <ChangeDataFolderStep
            folder={overrideFolder ?? undefined}
            setFolder={setOverrideFolder}
            onStart={() => triggerSetup(overrideFolder ?? undefined)}
          />
        );
      case "manualconfig":
        return () => (
          <ManualConfigStep
            config={manualConfig}
            onChange={setManualConfig}
            onBack={() => {
              setSetupProgress(defaultProgress);
              setSetupMode(null);
            }}
            onComplete={handleCompleteManual}
            validating={validating}
          />
        );
      case "clearvendor":
      case "ffmpeg":
      case "migratedata":
      case "uv":
      case "python":
      case "venv":
      case "dependencies":
      case "extractscripts":
      case "videos":
        return () => <LoadStep action={action} percent={percent} />;
      case "finish":
        return () => (
          <FinalStep
            folder={overrideFolder ?? undefined}
            isManual={setupMode === "manual"}
            warnings={setupMode === "manual" ? manualWarnings : undefined}
            onFinish={handleFinish}
          />
        );
      case "error":
        return () => <ErrorStep error={action} onExit={handleExit} />;
      default:
        return () => null;
    }
  }, [
    step,
    action,
    percent,
    overrideFolder,
    handleAutoSetup,
    handleManualSetup,
    manualConfig,
    handleCompleteManual,
    validating,
    handleFinish,
    handleExit,
    setupMode,
    manualWarnings,
  ]);

  return (
    <AlertDialog open={shouldRunSetup}>
      <AlertDialogContent data-nav-passthrough onEscapeKeyDown={(e) => e.preventDefault()}>
        <img src={logoSrc} width={80} height={80} />
        <Step />
      </AlertDialogContent>
    </AlertDialog>
  );
};