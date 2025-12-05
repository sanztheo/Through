"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useElectronAPI } from "@/hooks/useElectronAPI";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "running" | "completed" | "error";
}

interface StreamChunk {
  type: "text" | "tool-call" | "tool-result" | "done" | "error";
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

export function useChatAgent(projectPath: string) {
  const { api } = useElectronAPI();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!api?.streamChat || !api?.onChatChunk || isStreaming) return;

    setError(null);
    setIsStreaming(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    // Add placeholder assistant message
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isStreaming: true,
      toolCalls: [],
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);

    // Setup chunk listener
    const cleanup = api.onChatChunk((chunk: StreamChunk) => {
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.role !== "assistant") return prev;

        const updated = { ...lastMessage };

        switch (chunk.type) {
          case "text":
            updated.content += chunk.content || "";
            break;
          case "tool-call":
            if (chunk.toolCall) {
              updated.toolCalls = [...(updated.toolCalls || []), chunk.toolCall];
            }
            break;
          case "tool-result":
            if (chunk.toolCall) {
              updated.toolCalls = (updated.toolCalls || []).map(tc =>
                tc.name === chunk.toolCall!.name ? { ...tc, ...chunk.toolCall } : tc
              );
            }
            break;
          case "done":
            updated.isStreaming = false;
            break;
          case "error":
            updated.isStreaming = false;
            setError(chunk.error || "An error occurred");
            break;
        }

        return [...prev.slice(0, -1), updated];
      });

      if (chunk.type === "done" || chunk.type === "error") {
        setIsStreaming(false);
      }
    });

    cleanupRef.current = cleanup;

    // Prepare messages for API (exclude streaming state)
    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await api.streamChat(projectPath, apiMessages);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      setIsStreaming(false);
    }
  }, [api, messages, projectPath, isStreaming]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
}
