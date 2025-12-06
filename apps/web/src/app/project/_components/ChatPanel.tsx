"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { X, Send, Square, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import type { TimelineItem } from "../_hooks/useChatAgent";

interface ChatPanelProps {
  timeline: TimelineItem[];
  isStreaming: boolean;
  isThinking?: boolean;
  currentStreamText: string;
  currentThinkingText?: string;
  onSendMessage: (content: string) => void;
  onAbort: () => void;
  onClearHistory: () => void;
  onClose: () => void;
}

// Tool icons mapping
const toolIcons: Record<string, string> = {
  // Reading
  readFile: "📖",
  getLineRange: "📄",
  getFileInfo: "ℹ️",
  // Search
  searchInProject: "🔍",
  searchInFile: "🔎",
  searchByRegex: "🔣",
  findFilesByName: "📁",
  // Structure
  listFiles: "📂",
  getProjectStructure: "🌳",
  getPackageInfo: "📦",
  // Writing
  writeFile: "✏️",
  replaceInFile: "🔄",
  insertAtLine: "➕",
  appendToFile: "📝",
  // Management
  createFile: "🆕",
  deleteFile: "🗑️",
  copyFile: "📋",
  moveFile: "📤",
  // System
  runCommand: "⚡",
};

// Simple markdown parser
function SimpleMarkdown({ content }: { content: string }) {
  const parsed = useMemo(() => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let listItems: string[] = [];
    let listKey = 0;

    const parseInline = (text: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let key = 0;

      while (remaining.length > 0) {
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
          parts.push(
            <code key={key++} className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">
              {codeMatch[1]}
            </code>
          );
          remaining = remaining.slice(codeMatch[0].length);
          continue;
        }

        const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
        if (boldMatch) {
          parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        const italicMatch = remaining.match(/^\*([^*]+)\*/);
        if (italicMatch) {
          parts.push(<em key={key++}>{italicMatch[1]}</em>);
          remaining = remaining.slice(italicMatch[0].length);
          continue;
        }

        const nextSpecial = remaining.search(/[`*]/);
        if (nextSpecial === -1) {
          parts.push(remaining);
          break;
        } else if (nextSpecial === 0) {
          parts.push(remaining[0]);
          remaining = remaining.slice(1);
        } else {
          parts.push(remaining.slice(0, nextSpecial));
          remaining = remaining.slice(nextSpecial);
        }
      }
      return parts;
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${listKey++}`} className="list-disc list-inside mb-2 space-y-1">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm">{parseInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, index) => {
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${index}`} className="bg-gray-800 text-gray-100 p-2 rounded my-2 overflow-x-auto text-xs">
              <code>{codeBlockContent.join("\n")}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          flushList();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      if (line.startsWith("### ")) {
        flushList();
        elements.push(<h3 key={`h3-${index}`} className="text-sm font-bold mb-1">{parseInline(line.slice(4))}</h3>);
        return;
      }
      if (line.startsWith("## ")) {
        flushList();
        elements.push(<h2 key={`h2-${index}`} className="text-base font-bold mb-2">{parseInline(line.slice(3))}</h2>);
        return;
      }
      if (line.startsWith("# ")) {
        flushList();
        elements.push(<h1 key={`h1-${index}`} className="text-lg font-bold mb-2">{parseInline(line.slice(2))}</h1>);
        return;
      }

      const listMatch = line.match(/^[-*]\s+(.+)/);
      if (listMatch) {
        listItems.push(listMatch[1]);
        return;
      }

      const numListMatch = line.match(/^\d+\.\s+(.+)/);
      if (numListMatch) {
        listItems.push(numListMatch[1]);
        return;
      }

      if (line.trim() === "") {
        flushList();
        return;
      }

      flushList();
      elements.push(<p key={`p-${index}`} className="mb-2 last:mb-0">{parseInline(line)}</p>);
    });

    flushList();
    return elements;
  }, [content]);

  return <>{parsed}</>;
}

// Expandable Tool Card Component
function ToolCard({ item }: { item: TimelineItem & { type: "tool-call" } }) {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = () => {
    switch (item.status) {
      case "running": return "bg-yellow-50 border-yellow-300";
      case "completed": return "bg-green-50 border-green-300";
      case "error": return "bg-red-50 border-red-300";
      default: return "bg-gray-50 border-gray-300";
    }
  };

  const formatValue = (value: any): string => {
    if (typeof value === "string") {
      // Truncate long strings
      if (value.length > 200) {
        return value.substring(0, 200) + "...";
      }
      return value;
    }
    return JSON.stringify(value, null, 2);
  };

  return (
    <div className={`rounded-lg border ${getStatusColor()} overflow-hidden`}>
      {/* Header - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        <span className="text-lg">{toolIcons[item.name] || "🔧"}</span>
        <span className="font-medium text-gray-900">{item.name}</span>
        {item.args.filePath && (
          <span className="text-gray-600 truncate text-xs flex-1 text-left">
            {item.args.filePath}
          </span>
        )}
        {item.status === "running" && (
          <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
        )}
        {item.status === "completed" && (
          <span className="text-green-600 font-bold">✓</span>
        )}
        {item.status === "error" && (
          <span className="text-red-600 font-bold">✗</span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-current/10 px-3 py-2 bg-white/50 space-y-2">
          {/* Arguments */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Arguments:</p>
            <div className="bg-gray-100 rounded p-2 text-xs font-mono overflow-x-auto">
              {Object.entries(item.args).map(([key, value]) => (
                <div key={key} className="mb-1 last:mb-0">
                  <span className="text-blue-600">{key}:</span>{" "}
                  <span className="text-gray-800 whitespace-pre-wrap">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          {item.result && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Résultat:</p>
              <div className="bg-gray-100 rounded p-2 text-xs font-mono overflow-x-auto">
                {typeof item.result === "object" ? (
                  Object.entries(item.result).map(([key, value]) => (
                    <div key={key} className="mb-1 last:mb-0">
                      <span className="text-green-600">{key}:</span>{" "}
                      <span className="text-gray-800 whitespace-pre-wrap">{formatValue(value)}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-gray-800">{formatValue(item.result)}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Thinking Card Component
function ThinkingCard({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mx-2 rounded-lg border border-purple-200 bg-purple-50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-purple-100 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-purple-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-purple-500" />
        )}
        <span className="text-lg">🧠</span>
        <span className="font-medium text-purple-800">Réflexion</span>
        {isStreaming && (
          <Loader2 className="w-4 h-4 animate-spin text-purple-600 ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-purple-200 px-3 py-2 bg-white/50 max-h-48 overflow-y-auto">
          {content ? (
            <p className="text-xs text-purple-700 italic whitespace-pre-wrap">
              {content}
            </p>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 text-purple-500">
              <span className="text-xs italic">En train de réfléchir</span>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : (
            <p className="text-xs text-purple-400 italic">Pas de réflexion</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  timeline,
  isStreaming,
  isThinking,
  currentStreamText,
  currentThinkingText,
  onSendMessage,
  onAbort,
  onClearHistory,
  onClose,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline, currentStreamText]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isStreaming) {
      onSendMessage(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="w-[400px] h-full flex flex-col bg-white border-l border-gray-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isStreaming ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`} />
          <h2 className="font-semibold text-gray-800">Assistant IA</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClearHistory}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
            title="Effacer l'historique"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {timeline.length === 0 && !isStreaming && (
          <div className="text-center text-gray-400 py-12">
            <p className="text-sm">Commencez une conversation</p>
            <p className="text-xs mt-2">
              Ex: "Modifie le style du bouton" ou "Ajoute une animation"
            </p>
          </div>
        )}

        {/* Render timeline items chronologically */}
        {timeline.map((item) => {
          if (item.type === "user-message") {
            return (
              <div key={item.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg px-3 py-2 bg-blue-600 text-white">
                  <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                  <span className="text-[10px] opacity-60 mt-1 block">
                    {item.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          }

          if (item.type === "assistant-message") {
            return (
              <div key={item.id} className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-2 bg-gray-100 text-gray-800">
                  <div className="text-sm">
                    <SimpleMarkdown content={item.content} />
                  </div>
                  <span className="text-[10px] opacity-60 mt-1 block">
                    {item.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          }

          if (item.type === "tool-call") {
            return (
              <div key={item.id} className="mx-2">
                <ToolCard item={item} />
              </div>
            );
          }

          if (item.type === "thinking") {
            return (
              <ThinkingCard key={item.id} content={item.content} />
            );
          }

          return null;
        })}

        {/* Current Thinking (streaming) */}
        {isThinking && (
          <ThinkingCard content={currentThinkingText || ""} isStreaming={true} />
        )}

        {/* Streaming Response */}
        {isStreaming && currentStreamText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-gray-100 text-gray-800">
              <div className="text-sm">
                <SimpleMarkdown content={currentStreamText} />
              </div>
              <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
            </div>
          </div>
        )}

        {/* Loading/Working indicator when agent is processing */}
        {isStreaming && !currentStreamText && !isThinking && (
          <div className="mx-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">L'agent analyse...</p>
                <p className="text-xs text-blue-500">Exploration du projet et exécution des outils</p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Décrivez ce que vous voulez modifier..."
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[60px] max-h-[120px]"
            disabled={isStreaming}
          />
          <div className="flex flex-col gap-1">
            {isStreaming ? (
              <button
                type="button"
                onClick={onAbort}
                className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                title="Arrêter"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Envoyer (⌘+Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          ⌘+Enter pour envoyer
        </p>
      </div>
    </div>
  );
}
