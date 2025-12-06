"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

import { X, Send, Square, Trash2, Loader2, ChevronDown, ChevronRight, Check, RotateCcw, EyeOff, FileText, History, Plus, MoreHorizontal, MessageSquare, ArrowUp, Brain, Zap } from "lucide-react";
import type { TimelineItem, PendingChange, AppSettings, ModelDefinition } from "../_hooks/useChatAgent";

interface ConversationSummary {
  id: string;
  title: string;
  timestamp: string;
  messages: any[];
}

interface ChatPanelProps {
  timeline: TimelineItem[];
  conversations?: ConversationSummary[];
  currentConversationId?: string | null;
  isStreaming: boolean;
  isThinking?: boolean;
  currentStreamText: string;
  currentThinkingText?: string;
  pendingChanges?: PendingChange[];
  projectFiles?: string[];
  onSendMessage: (content: string) => void;
  onAbort: () => void;
  onClearHistory: () => void;
  onClose: () => void;
  onValidateChanges?: () => void;
  onRejectChanges?: () => void;
  onDismissChanges?: () => void;
  onLoadConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (id: string) => void;
  settings?: AppSettings | null;
  availableModels?: ModelDefinition[];
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
  onToggleChanges?: (visible: boolean) => void;
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
  conversations = [],
  currentConversationId,
  isStreaming,
  isThinking,
  currentStreamText,
  currentThinkingText,
  pendingChanges = [],
  projectFiles = [],
  onSendMessage,
  onAbort,
  onClearHistory,
  onClose,
  onValidateChanges,
  onRejectChanges,
  onDismissChanges,
  onLoadConversation,
  onNewConversation,
  onDeleteConversation,
  settings,
  availableModels = [],
  onUpdateSettings,
  onToggleChanges,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [mentionedFiles, setMentionedFiles] = useState<string[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [showValidationBar, setShowValidationBar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);

  // Show validation bar when new changes arrive
  useEffect(() => {
    if (pendingChanges && pendingChanges.length > 0) {
      setShowValidationBar(true);
    }
  }, [pendingChanges]);

  // Group conversations by date (Today, Yesterday, Older)
  const groupedConversations = useMemo(() => {
    const groups: { label: string; items: ConversationSummary[] }[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Previous 7 Days", items: [] },
      { label: "Older", items: [] },
    ];

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    conversations.forEach(conv => {
      const date = new Date(conv.timestamp);
      if (date.toDateString() === today.toDateString()) {
        groups[0].items.push(conv);
      } else if (date.toDateString() === yesterday.toDateString()) {
        groups[1].items.push(conv);
      } else if (date > lastWeek) {
        groups[2].items.push(conv);
      } else {
        groups[3].items.push(conv);
      }
    });

    return groups.filter(g => g.items.length > 0);
  }, [conversations]);

  // Filter files based on mention filter
  const filteredFiles = useMemo(() => {
    if (!mentionFilter) return projectFiles.slice(0, 10);
    const lower = mentionFilter.toLowerCase();
    return projectFiles
      .filter(f => f.toLowerCase().includes(lower))
      .slice(0, 10);
  }, [projectFiles, mentionFilter]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline, currentStreamText]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selected index when filtered files change
  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [filteredFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check if we're mentioning a file
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s\[\]]*)$/);

    if (atMatch) {
      setShowMentionMenu(true);
      setMentionFilter(atMatch[1]);
    } else {
      setShowMentionMenu(false);
      setMentionFilter("");
    }
  };

  const insertMention = (file: string) => {
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBeforeCursor = input.substring(0, cursorPos);
    const textAfterCursor = input.substring(cursorPos);
    
    // Find the @ and remove it from input
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex !== -1) {
      const newText = textBeforeCursor.substring(0, atIndex) + textAfterCursor;
      setInput(newText.trim());
    }
    
    // Add file to mentioned files if not already there
    if (!mentionedFiles.includes(file)) {
      setMentionedFiles(prev => [...prev, file]);
    }
    
    setShowMentionMenu(false);
    setMentionFilter("");
    inputRef.current?.focus();
  };

  const removeMention = (file: string) => {
    setMentionedFiles(prev => prev.filter(f => f !== file));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((input.trim() || mentionedFiles.length > 0) && !isStreaming) {
      // Build message with file mentions prefix
      let fullMessage = input.trim();
      if (mentionedFiles.length > 0) {
        const mentionsPrefix = mentionedFiles.map(f => `@[${f}]`).join(" ");
        fullMessage = mentionsPrefix + (fullMessage ? " " + fullMessage : "");
      }
      
      onSendMessage(fullMessage);
      setInput("");
      setMentionedFiles([]);
      setShowMentionMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionMenu && filteredFiles.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.min(prev + 1, filteredFiles.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredFiles[selectedMentionIndex]);
        return;
      } else if (e.key === "Escape") {
        setShowMentionMenu(false);
        return;
      }
    }
    
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="w-[400px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl font-sans relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-900">Through</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              onNewConversation?.();
              setIsHistoryOpen(false);
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Nouvelle conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${isHistoryOpen ? "bg-gray-100 text-gray-900" : "text-gray-500"}`}
            title="Historique"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Plus"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* History Overlay */}
      {isHistoryOpen && (
        <div className="absolute top-[57px] left-0 w-full bottom-0 bg-white z-20 overflow-y-auto border-t border-gray-100 p-2 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="space-y-4 p-2">
            {groupedConversations.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-gray-400 mb-2 px-2 uppercase tracking-wider">{group.label}</h3>
                <div className="space-y-1">
                  {group.items.map((conv) => (
                    <div 
                      key={conv.id} 
                      className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        currentConversationId === conv.id ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        onLoadConversation?.(conv.id);
                        setIsHistoryOpen(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${currentConversationId === conv.id ? "text-blue-700" : "text-gray-700"}`}>
                          {conv.title || "Untitled Conversation"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation?.(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {conversations.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Aucun historique récente</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline Area or Empty State */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {timeline.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 -mt-10">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 border border-gray-100">
              <span className="text-2xl">⚡️</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Through Agent</h3>
            <p className="text-sm text-center max-w-[260px] leading-relaxed">
              Je peux analyser votre projet, modifier des fichiers et exécuter des commandes.
            </p>
            
            <div className="mt-8 grid grid-cols-2 gap-2 w-full max-w-[320px]">
              <button 
                onClick={() => setInput("Explique moi ce projet")}
                className="p-3 text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition-colors"
                type="button"
              >
                🔍 Explique le projet
              </button>
              <button 
                 onClick={() => setInput("Check les erreurs Typescript")}
                 className="p-3 text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition-colors"
                 type="button"
              >
                🐞 Check erreurs
              </button>
              <button 
                onClick={() => setInput("Optimise le composant Button")}
                className="p-3 text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition-colors"
                type="button"
              >
                🎨 Optimise UI
              </button>
              <button 
                onClick={() => setInput("Crée un fichier README.md")}
                className="p-3 text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition-colors"
                type="button"
              >
                📝 Créer README
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {timeline.map((item) => {
              if (item.type === "user-message") {
                return (
                  <div key={item.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 bg-blue-600 text-white shadow-sm">
                      <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                    </div>
                  </div>
                );
              }

              if (item.type === "assistant-message") {
                return (
                  <div key={item.id} className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-gray-100 text-gray-800 shadow-sm">
                      <div className="text-sm prose prose-sm max-w-none">
                        <SimpleMarkdown content={item.content} />
                      </div>
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
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-gray-100 text-gray-800 shadow-sm">
                  <div className="text-sm">
                    <SimpleMarkdown content={currentStreamText} />
                  </div>
                  <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
                </div>
              </div>
            )}

            {/* Loading/Working indicator */}
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
        )}
      </div>

      {/* Pending Changes Validation Bar */}
      {pendingChanges.length > 0 && !isStreaming && (
        showValidationBar ? (
          <div className="border-t border-orange-200 bg-orange-50 px-3 py-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-orange-600 text-sm font-medium">
                  📝 {pendingChanges.length} modification{pendingChanges.length > 1 ? "s" : ""} en attente
                </span>
                <span className="text-orange-500 text-xs opacity-75 hidden sm:inline">
                  {pendingChanges.map(c => c.type).join(", ").slice(0, 30)}{pendingChanges.length > 3 ? "..." : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onValidateChanges}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                  title="Valider et conserver les modifications"
                >
                  <Check className="w-3.5 h-3.5" />
                  Valider
                </button>
                <button
                  onClick={onRejectChanges}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                  title="Annuler toutes les modifications (restaurer backups)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Annuler
                </button>
                <div className="w-[1px] h-6 bg-orange-200 mx-1"></div>
                <button
                  onClick={() => {
                    setShowValidationBar(false);
                    onToggleChanges?.(false);
                  }}
                  className="flex items-center justify-center p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                  title="Masquer les modifications (voir l'original)"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute bottom-[60px] right-4 z-20">
            <button
              onClick={() => {
                setShowValidationBar(true);
                onToggleChanges?.(true);
              }}
              className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-2 rounded-xl shadow-lg border border-orange-200 text-xs font-medium transition-all hover:scale-105 ring-1 ring-orange-200/50"
              title="Afficher les modifications (voir le résultat)"
            >
              <div className="relative">
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                <span className="text-lg">📝</span>
              </div>
              <div className="flex flex-col items-start -space-y-0.5">
                <span className="font-bold">{pendingChanges.length} modif{pendingChanges.length > 1 ? "s" : ""}</span>
                <span className="text-[10px] opacity-75">En attente</span>
              </div>
              <ChevronDown className="w-3 h-3 rotate-180 text-orange-400" />
            </button>
          </div>
        )
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3 relative">
        {/* File mention dropdown */}
        {showMentionMenu && filteredFiles.length > 0 && (
          <div 
            ref={mentionMenuRef}
            className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10"
          >
            <div className="p-1">
              <p className="text-xs text-gray-400 px-2 py-1">Fichiers</p>
              {filteredFiles.map((file, index) => (
                <button
                  key={file}
                  type="button"
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors ${
                    index === selectedMentionIndex 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => insertMention(file)}
                >
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{file}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mentioned files badges */}
        {mentionedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {mentionedFiles.map((file) => (
              <span
                key={file}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-800 text-gray-100 text-xs rounded-md font-mono"
              >
                <span className="text-blue-400">@</span>
                <span className="truncate max-w-[150px]">{file.split("/").pop()}</span>
                <button
                  type="button"
                  onClick={() => removeMention(file)}
                  className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question, @ pour mentionner..."
              className="w-full resize-none bg-transparent border-none px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 min-h-[50px] max-h-[200px]"
              rows={1}
              disabled={isStreaming}
              style={{ overflowY: 'hidden' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />
            
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  title="Ajouter un fichier"
                >
                  <Plus className="w-4 h-4" />
                </button>
                
                <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                
                {/* Thinking Mode Toggle */}
                {(() => {
                  const currentModel = availableModels.find(m => m.id === settings?.aiModel);
                  const supportsThinking = currentModel?.supportsThinking ?? false;
                  
                  return (
                    <button 
                      type="button" 
                      disabled={!supportsThinking}
                      onClick={() => onUpdateSettings?.({ extendedThinking: !settings?.extendedThinking })}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-all ${
                        !supportsThinking ? "opacity-50 cursor-not-allowed text-gray-400 bg-gray-50" :
                        settings?.extendedThinking 
                          ? "text-purple-700 bg-purple-50 hover:bg-purple-100 ring-1 ring-purple-200" 
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                      title={!supportsThinking ? "Ce modèle ne supporte pas le mode pensée" : (settings?.extendedThinking ? "Mode pensée activé" : "Mode rapide")}
                    >
                      {settings?.extendedThinking && supportsThinking ? (
                        <>
                          <Brain className="w-3 h-3" />
                          <span>Thinking</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          <span>Fast</span>
                        </>
                      )}
                    </button>
                  );
                })()}

                 {/* Model Selector */}
                <div className="relative">
                  <button 
                    type="button" 
                    onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    <span>{availableModels.find(m => m.id === settings?.aiModel)?.name || "Model"}</span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>

                  {isModelMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsModelMenuOpen(false)} 
                      />
                      <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-20 py-1 max-h-64 overflow-y-auto">
                        {availableModels.map((model) => (
                           <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              onUpdateSettings?.({ aiModel: model.id });
                              setIsModelMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex flex-col gap-0.5 ${
                              settings?.aiModel === model.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                            }`}
                          >
                            <span className="font-medium">{model.name}</span>
                            <span className="text-[10px] text-gray-400 truncate">{model.description}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                 {isStreaming ? (
                   <button
                    onClick={onAbort}
                    className="p-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                 ) : (
                   <button
                    onClick={() => handleSubmit()}
                    disabled={!input.trim() && mentionedFiles.length === 0}
                    className="p-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                 )}
              </div>
            </div>
          </div>
          
          <div className="mt-2 flex justify-center">
            <p className="text-[10px] text-gray-400">
               <span className="font-mono text-xs">@</span> pour mentionner • <span className="font-mono text-xs">⏎</span> pour envoyer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
