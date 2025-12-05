"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, X, Trash2, Loader2, Bot, User } from "lucide-react";
import { useChatAgent, ChatMessage } from "@/app/project/_hooks/useChatAgent";
import { ToolCallCard } from "./ToolCallCard";
import { MarkdownContent } from "./MarkdownContent";

import { FileCode } from "lucide-react";
import { useProjectFiles } from "@/app/project/_hooks/useProjectFiles";

interface ChatPanelProps {
  projectPath: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ projectPath, isOpen, onClose }: ChatPanelProps) {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChatAgent(projectPath);
  const files = useProjectFiles(projectPath);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle input change for mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @ mention
    const lastAt = value.lastIndexOf("@");
    if (lastAt !== -1 && lastAt >= value.lastIndexOf(" ")) {
      const query = value.slice(lastAt + 1);
      setMentionQuery(query);
      setShowMentions(true);
      
      const filtered = files
        .filter(f => f.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10); // Limit results
      setFilteredFiles(filtered);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (file: string) => {
    const lastAt = input.lastIndexOf("@");
    if (lastAt !== -1) {
      const newValue = input.slice(0, lastAt) + file + " " + input.slice(input.length);
      setInput(newValue);
      setShowMentions(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredFiles.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredFiles.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredFiles.length) % filteredFiles.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredFiles[mentionIndex]);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming && !showMentions) {
      sendMessage(input.trim());
      setInput("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-500" />
          <span className="font-medium text-gray-900">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Ask me anything about your project!</p>
            <p className="text-xs mt-1">I can read files, edit code, run commands...</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Mention Popup */}
      {showMentions && filteredFiles.length > 0 && (
        <div className="mx-4 mb-2 border border-gray-200 rounded-lg shadow-lg bg-white overflow-hidden max-h-48 overflow-y-auto z-10">
          {filteredFiles.map((file, idx) => (
            <button
              key={file}
              onClick={() => insertMention(file)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 ${
                idx === mentionIndex ? "bg-blue-50 text-blue-700" : "text-gray-700"
              }`}
            >
              <FileCode className="w-4 h-4 opacity-50" />
              <span className="truncate">{file}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything... (Type @ to add file)"
            disabled={isStreaming}
            className="flex-1 px-4 py-2 bg-white text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-blue-600" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? "order-first" : ""}`}>
        <div
          className={`rounded-lg px-4 py-2 ${
            isUser
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-900"
          }`}
        >
          {message.content ? (
            isUser ? (
              message.content
            ) : (
              <MarkdownContent content={message.content} />
            )
          ) : (
            message.isStreaming && (
              <span className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </span>
            )
          )}
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-gray-600" />
        </div>
      )}
    </div>
  );
}
