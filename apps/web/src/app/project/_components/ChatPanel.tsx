"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { X, Send, Square, Trash2, Loader2 } from "lucide-react";
import type { ChatMessage, ActiveToolCall } from "../_hooks/useChatAgent";

interface ChatPanelProps {
  messages: ChatMessage[];
  activeTools: ActiveToolCall[];
  isStreaming: boolean;
  currentStreamText: string;
  onSendMessage: (content: string) => void;
  onAbort: () => void;
  onClearHistory: () => void;
  onClose: () => void;
}

// Tool icons mapping
const toolIcons: Record<string, string> = {
  readFile: "📖",
  writeFile: "✏️",
  replaceInFile: "🔄",
  searchInProject: "🔍",
  listFiles: "📂",
  createFile: "📄",
  deleteFile: "🗑️",
};

// Simple markdown parser (no external dependencies)
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

      // Process inline formatting
      while (remaining.length > 0) {
        // Code inline `code`
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

        // Bold **text**
        const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
        if (boldMatch) {
          parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        // Italic *text*
        const italicMatch = remaining.match(/^\*([^*]+)\*/);
        if (italicMatch) {
          parts.push(<em key={key++}>{italicMatch[1]}</em>);
          remaining = remaining.slice(italicMatch[0].length);
          continue;
        }

        // Regular text until next special char
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
      // Code block
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

      // Headers
      if (line.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 key={`h3-${index}`} className="text-sm font-bold mb-1">
            {parseInline(line.slice(4))}
          </h3>
        );
        return;
      }
      if (line.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={`h2-${index}`} className="text-base font-bold mb-2">
            {parseInline(line.slice(3))}
          </h2>
        );
        return;
      }
      if (line.startsWith("# ")) {
        flushList();
        elements.push(
          <h1 key={`h1-${index}`} className="text-lg font-bold mb-2">
            {parseInline(line.slice(2))}
          </h1>
        );
        return;
      }

      // List items
      const listMatch = line.match(/^[-*]\s+(.+)/);
      if (listMatch) {
        listItems.push(listMatch[1]);
        return;
      }

      // Numbered list
      const numListMatch = line.match(/^\d+\.\s+(.+)/);
      if (numListMatch) {
        listItems.push(numListMatch[1]);
        return;
      }

      // Empty line
      if (line.trim() === "") {
        flushList();
        return;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${index}`} className="mb-2 last:mb-0">
          {parseInline(line)}
        </p>
      );
    });

    flushList();
    return elements;
  }, [content]);

  return <>{parsed}</>;
}

export function ChatPanel({
  messages,
  activeTools,
  isStreaming,
  currentStreamText,
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
  }, [messages, currentStreamText, activeTools]);

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
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && activeTools.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <p className="text-sm">Commencez une conversation</p>
            <p className="text-xs mt-2">
              Ex: "Liste les fichiers dans src" ou "Modifie le bouton principal"
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="text-sm">
                  <SimpleMarkdown content={msg.content} />
                </div>
              )}
              <span className="text-[10px] opacity-60 mt-1 block">
                {msg.timestamp.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}

        {/* Active Tool Calls */}
        {activeTools.length > 0 && (
          <div className="space-y-2">
            {activeTools.map((tool) => (
              <div
                key={tool.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  tool.status === "running"
                    ? "bg-yellow-50 border border-yellow-200"
                    : tool.status === "completed"
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <span>{toolIcons[tool.name] || "🔧"}</span>
                <span className="font-medium text-gray-900">{tool.name}</span>
                {tool.args.filePath && (
                  <span className="text-gray-700 truncate text-xs">
                    {tool.args.filePath}
                  </span>
                )}
                {tool.status === "running" && (
                  <Loader2 className="w-3 h-3 animate-spin ml-auto text-yellow-600" />
                )}
                {tool.status === "completed" && (
                  <span className="ml-auto text-green-600 text-xs">✓</span>
                )}
              </div>
            ))}
          </div>
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

        {/* Loading indicator when no text yet */}
        {isStreaming && !currentStreamText && activeTools.length === 0 && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm text-gray-500">Réflexion...</span>
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
