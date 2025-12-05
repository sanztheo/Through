import React from "react";
import { AgentModification } from "../_hooks/useAgentModifications";
import { Loader2, CheckCircle, XCircle, AlertCircle, Check, X, Eye, EyeOff } from "lucide-react";

interface PendingModificationsListProps {
  modifications: AgentModification[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDismiss: (id: string) => void;
  onTogglePreview: (id: string) => void;
}

export function PendingModificationsList({
  modifications,
  onAccept,
  onReject,
  onDismiss,
  onTogglePreview,
}: PendingModificationsListProps) {
  if (modifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {modifications.map((mod) => (
        <ModificationItem
          key={mod.id}
          modification={mod}
          onAccept={() => onAccept(mod.id)}
          onReject={() => onReject(mod.id)}
          onDismiss={() => onDismiss(mod.id)}
          onTogglePreview={() => onTogglePreview(mod.id)}
        />
      ))}
    </div>
  );
}

function ModificationItem({
  modification,
  onAccept,
  onReject,
  onDismiss,
  onTogglePreview,
}: {
  modification: AgentModification;
  onAccept: () => void;
  onReject: () => void;
  onDismiss: () => void;
  onTogglePreview: () => void;
}) {
  const { status, prompt, result, elementInfo, isPreviewingOriginal } = modification;

  const statusConfig = {
    loading: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
      label: "En cours...",
    },
    pending: {
      bg: "bg-green-50",
      border: "border-green-200",
      icon: <CheckCircle className="w-4 h-4 text-green-500" />,
      label: isPreviewingOriginal ? "Avant" : "À valider",
    },
    accepted: {
      bg: "bg-green-100",
      border: "border-green-300",
      icon: <CheckCircle className="w-4 h-4 text-green-600" />,
      label: "Validé ✓",
    },
    rejected: {
      bg: "bg-yellow-100",
      border: "border-yellow-300",
      icon: <XCircle className="w-4 h-4 text-yellow-600" />,
      label: "Annulé",
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
      label: "Erreur",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`p-2 rounded-lg border ${config.bg} ${config.border}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {config.icon}
        <span className="text-xs font-medium text-gray-700">{config.label}</span>
        <span className="text-xs text-gray-400 ml-auto">
          &lt;{elementInfo.tagName}&gt;
        </span>
      </div>

      {/* Prompt */}
      <p className="text-xs text-gray-600 truncate mb-1" title={prompt}>
        "{prompt}"
      </p>

      {/* Result message */}
      {result && (
        <p className="text-xs text-gray-500 truncate mb-2">
          {result.modifiedFile ? `📄 ${result.modifiedFile.split('/').pop()}` : result.message}
        </p>
      )}

      {/* Actions */}
      {status === "pending" && (
        <div className="flex gap-1">
          <button
            onClick={onTogglePreview}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${
              isPreviewingOriginal 
                ? "bg-purple-500 hover:bg-purple-600 text-white" 
                : "bg-gray-200 hover:bg-gray-300 text-gray-600"
            }`}
            title={isPreviewingOriginal ? "Voir les modifications" : "Voir l'original"}
          >
            {isPreviewingOriginal ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
          >
            <Check className="w-3 h-3" />
            Valider
          </button>
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Annuler
          </button>
        </div>
      )}

      {/* Dismiss error */}
      {status === "error" && (
        <button
          onClick={onDismiss}
          className="w-full py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Fermer
        </button>
      )}
    </div>
  );
}
