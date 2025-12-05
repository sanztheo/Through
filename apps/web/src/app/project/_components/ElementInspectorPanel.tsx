import React from "react";
import { ElementInfo } from "../_hooks/useElementInspector";
import { X, Copy, Check } from "lucide-react";

interface ElementInspectorPanelProps {
  element: ElementInfo | null;
  onClose: () => void;
}

export function ElementInspectorPanel({ element, onClose }: ElementInspectorPanelProps) {
  const [copiedSelector, setCopiedSelector] = React.useState(false);

  if (!element) return null;

  const copySelector = async () => {
    try {
      await navigator.clipboard.writeText(element.selector);
      setCopiedSelector(true);
      setTimeout(() => setCopiedSelector(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  // Format CSS value for display
  const formatCssValue = (value: string) => {
    if (!value || value === "none" || value === "0px" || value === "auto") {
      return <span className="text-gray-400">{value || "none"}</span>;
    }
    return value;
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-gray-900">Element Inspector</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Element Tag */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-purple-600 font-mono text-sm">&lt;{element.tagName}</span>
              {element.id && (
                <span className="text-blue-600 font-mono text-sm">#{element.id}</span>
              )}
              <span className="text-purple-600 font-mono text-sm">&gt;</span>
            </div>
          </div>
          {element.className && typeof element.className === 'string' && (
            <div className="mt-1 flex flex-wrap gap-1">
              {element.className.split(/\s+/).filter(Boolean).slice(0, 5).map((cls, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-600"
                >
                  .{cls}
                </span>
              ))}
              {element.className.split(/\s+/).filter(Boolean).length > 5 && (
                <span className="px-1.5 py-0.5 text-xs text-gray-400">
                  +{element.className.split(/\s+/).filter(Boolean).length - 5} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Selector */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Selector</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 truncate">
              {element.selector}
            </code>
            <button
              onClick={copySelector}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              title="Copy selector"
            >
              {copiedSelector ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Dimensions */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Dimensions</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Width:</span>
              <span className="ml-1 font-mono text-gray-900">
                {Math.round(element.rect.width)}px
              </span>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Height:</span>
              <span className="ml-1 font-mono text-gray-900">
                {Math.round(element.rect.height)}px
              </span>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">X:</span>
              <span className="ml-1 font-mono text-gray-900">
                {Math.round(element.rect.x)}px
              </span>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Y:</span>
              <span className="ml-1 font-mono text-gray-900">
                {Math.round(element.rect.y)}px
              </span>
            </div>
          </div>
        </div>

        {/* Box Model Preview */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Box Model</div>
          <div className="flex justify-center">
            <div className="relative bg-orange-100 p-3 text-center text-[10px]">
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-orange-600 font-mono">
                {element.computedStyle.margin || "0"}
              </span>
              <div className="bg-green-100 p-3">
                <span className="absolute top-3 left-1/2 -translate-x-1/2 text-green-600 font-mono">
                  {element.computedStyle.padding || "0"}
                </span>
                <div className="bg-blue-200 px-3 py-2 min-w-[60px]">
                  <span className="font-mono text-blue-800">
                    {Math.round(element.rect.width)} × {Math.round(element.rect.height)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-orange-200 rounded-sm" /> margin
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-200 rounded-sm" /> padding
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-200 rounded-sm" /> content
            </span>
          </div>
        </div>

        {/* Computed Styles */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Computed Styles</div>
          <div className="space-y-1">
            {Object.entries(element.computedStyle).map(([key, value]) => (
              <div key={key} className="flex items-center text-xs">
                <span className="text-purple-600 font-mono w-28 truncate">{key}:</span>
                <span className="font-mono text-gray-700 truncate flex-1">
                  {formatCssValue(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Attributes */}
        {element.attributes.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Attributes</div>
            <div className="space-y-1">
              {element.attributes.slice(0, 10).map((attr, i) => (
                <div key={i} className="flex items-start text-xs">
                  <span className="text-blue-600 font-mono w-20 truncate flex-shrink-0">
                    {attr.name}
                  </span>
                  <span className="text-gray-400 mx-1">=</span>
                  <span className="font-mono text-green-600 truncate">
                    &quot;{attr.value.substring(0, 50)}{attr.value.length > 50 ? '...' : ''}&quot;
                  </span>
                </div>
              ))}
              {element.attributes.length > 10 && (
                <div className="text-xs text-gray-400">
                  +{element.attributes.length - 10} more attributes
                </div>
              )}
            </div>
          </div>
        )}

        {/* Element Info */}
        <div className="px-3 py-2">
          <div className="text-xs text-gray-500 mb-2">Info</div>
          <div className="space-y-1 text-xs">
            <div className="flex">
              <span className="text-gray-500 w-24">Children:</span>
              <span className="text-gray-700">{element.childCount}</span>
            </div>
            {element.parentTag && (
              <div className="flex">
                <span className="text-gray-500 w-24">Parent:</span>
                <span className="text-purple-600 font-mono">&lt;{element.parentTag}&gt;</span>
              </div>
            )}
            {element.textContent && (
              <div className="mt-2">
                <span className="text-gray-500">Text content:</span>
                <div className="mt-1 p-2 bg-gray-50 rounded text-gray-600 font-mono text-[11px] break-words">
                  {element.textContent.substring(0, 100)}
                  {element.textContent.length > 100 ? '...' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
