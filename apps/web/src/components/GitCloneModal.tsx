"use client";

import { useState, useEffect } from "react";
import {
  X,
  GitBranch,
  Folder,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
} from "lucide-react";

interface GitCloneModalProps {
  onClose: () => void;
  onComplete: (projectPath: string, projectName: string) => void;
}

type Step = "folder" | "url" | "cloning" | "installing" | "done" | "error";

interface CloneProgress {
  stage: string;
  percent?: number;
  message: string;
}

interface InstallProgress {
  stage: string;
  percent?: number;
  message: string;
  packageManager?: string;
}

export function GitCloneModal({ onClose, onComplete }: GitCloneModalProps) {
  const [step, setStep] = useState<Step>("folder");
  const [destPath, setDestPath] = useState<string>("");
  const [gitUrl, setGitUrl] = useState<string>("");
  const [urlError, setUrlError] = useState<string>("");
  const [cloneProgress, setCloneProgress] = useState<CloneProgress | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [projectPath, setProjectPath] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");

  // Setup progress listeners
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const unsubClone = window.electronAPI.onCloneProgress((progress: CloneProgress) => {
      console.log("[GitClone] Progress:", progress);
      setCloneProgress(progress);

      if (progress.stage === "done") {
        // Move to install step
        setTimeout(() => {
          setStep("installing");
        }, 500);
      } else if (progress.stage === "error") {
        setErrorMessage(progress.message);
        setStep("error");
      }
    });

    const unsubInstall = window.electronAPI.onInstallProgress((progress: InstallProgress) => {
      console.log("[Install] Progress:", progress);
      setInstallProgress(progress);

      if (progress.stage === "done") {
        setStep("done");
      } else if (progress.stage === "error") {
        // Don't treat install error as fatal, still allow to proceed
        setStep("done");
      }
    });

    return () => {
      unsubClone?.();
      unsubInstall?.();
    };
  }, []);

  // When entering install step, trigger install
  useEffect(() => {
    if (step === "installing" && projectPath && window.electronAPI) {
      window.electronAPI.installDependencies(projectPath);
    }
  }, [step, projectPath]);

  const handleSelectFolder = async () => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const folder = await window.electronAPI.selectFolderForClone();
    if (folder) {
      setDestPath(folder);
    }
  };

  const validateGitUrl = (url: string): boolean => {
    // Basic validation for git URLs
    const patterns = [
      /^https?:\/\/.+\/.+$/,  // HTTP(S) URLs
      /^git@.+:.+\/.+$/,      // SSH URLs
    ];
    return patterns.some((p) => p.test(url));
  };

  const handleUrlChange = (value: string) => {
    setGitUrl(value);
    if (value && !validateGitUrl(value)) {
      setUrlError("URL invalide. Ex: https://github.com/user/repo.git");
    } else {
      setUrlError("");
    }
  };

  const handleStartClone = async () => {
    if (!gitUrl || !destPath || !window.electronAPI) return;

    setStep("cloning");
    setCloneProgress({ stage: "cloning", message: "Initialisation..." });

    try {
      const result = await window.electronAPI.cloneRepo(gitUrl, destPath);

      if (result.success) {
        setProjectPath(result.projectPath);
        setProjectName(result.projectName);
        // Progress listener will handle the transition to install step
      } else {
        setErrorMessage(result.error || "Échec du clonage");
        setStep("error");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Erreur inattendue");
      setStep("error");
    }
  };

  const handleComplete = () => {
    onComplete(projectPath, projectName);
  };

  const handleRetry = () => {
    setStep("url");
    setErrorMessage("");
    setCloneProgress(null);
    setInstallProgress(null);
  };

  const canProceedToUrl = !!destPath;
  const canStartClone = !!gitUrl && !urlError && !!destPath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 non-draggable">
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] flex flex-col overflow-hidden border border-[#ECECEC]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECECEC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black">Clone Repository</h2>
              <p className="text-xs text-black/40 font-['Geist'] font-medium">
                {step === "folder" && "Étape 1/2 : Destination"}
                {step === "url" && "Étape 2/2 : URL du repository"}
                {step === "cloning" && "Clonage en cours..."}
                {step === "installing" && "Installation des dépendances..."}
                {step === "done" && "Terminé !"}
                {step === "error" && "Erreur"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Select Folder */}
          {step === "folder" && (
            <div className="space-y-4">
              <p className="text-sm text-black/60 font-['Geist']">
                Choisissez le dossier où le repository sera cloné.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={destPath}
                  readOnly
                  placeholder="Sélectionnez un dossier..."
                  className="flex-1 px-4 py-3 border border-[#ECECEC] rounded-lg text-sm text-black font-['Geist'] placeholder:text-black/30 bg-gray-50"
                />
                <button
                  onClick={handleSelectFolder}
                  className="px-4 py-3 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Folder className="w-4 h-4" />
                  Parcourir
                </button>
              </div>

              <button
                onClick={() => setStep("url")}
                disabled={!canProceedToUrl}
                className="w-full py-3 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continuer
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2: Enter URL */}
          {step === "url" && (
            <div className="space-y-4">
              <p className="text-sm text-black/60 font-['Geist']">
                Entrez l'URL du repository Git à cloner.
              </p>

              <div className="space-y-2">
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className={`w-full px-4 py-3 border rounded-lg text-sm text-black font-['Geist'] placeholder:text-black/30 focus:outline-none transition-colors ${
                    urlError
                      ? "border-red-400 focus:border-red-500"
                      : "border-[#ECECEC] focus:border-[#4DAFE3]"
                  }`}
                  autoFocus
                />
                {urlError && (
                  <p className="text-xs text-red-500 font-['Geist']">{urlError}</p>
                )}
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-black/50 font-['Geist']">
                  <span className="font-medium">Destination:</span> {destPath}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("folder")}
                  className="flex-1 py-3 border border-[#ECECEC] text-black rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={handleStartClone}
                  disabled={!canStartClone}
                  className="flex-1 py-3 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Cloning Progress */}
          {step === "cloning" && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-black">
                    {cloneProgress?.message || "Clonage en cours..."}
                  </p>
                  {cloneProgress?.percent !== undefined && (
                    <p className="text-xs text-black/50 mt-1">
                      {cloneProgress.percent}%
                    </p>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {cloneProgress?.percent !== undefined && (
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${cloneProgress.percent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Installing Dependencies */}
          {step === "installing" && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-purple-500 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-black">
                    {installProgress?.message || "Installation des dépendances..."}
                  </p>
                  {installProgress?.packageManager && (
                    <p className="text-xs text-black/50 mt-1">
                      via {installProgress.packageManager}
                    </p>
                  )}
                </div>
              </div>

              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* Step 5: Done */}
          {step === "done" && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-black">
                    Repository cloné avec succès !
                  </p>
                  <p className="text-xs text-black/50 mt-1">{projectName}</p>
                </div>
              </div>

              <button
                onClick={handleComplete}
                className="w-full py-3 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
              >
                Configurer le projet
              </button>
            </div>
          )}

          {/* Error State */}
          {step === "error" && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-black">
                    Échec du clonage
                  </p>
                  <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-[#ECECEC] text-black rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
