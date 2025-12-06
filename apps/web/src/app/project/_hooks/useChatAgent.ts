"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ActiveToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  status: "running" | "completed" | "error";
  result?: any;
}

interface ElectronAPI {
  streamChat?: (projectPath: string, messages: Array<{ role: string; content: string }>) => Promise<any>;
  onChatChunk?: (callback: (chunk: any) => void) => () => void;
  onChatToolCall?: (callback: (toolCall: { id: string; name: string; args: any }) => void) => () => void;
  onChatToolResult?: (callback: (result: { id: string; name: string; result: any }) => void) => () => void;
  abortChat?: () => Promise<void>;
}

export function useChatAgent(api: ElectronAPI | null, projectPath: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTools, setActiveTools] = useState<ActiveToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState("");
  
  // Use ref to track stream text to avoid closure issues
  const streamTextRef = useRef("");
  const hasAddedMessageRef = useRef(false);
  const listenersSetupRef = useRef(false);

  // Setup listeners only once when API becomes available
  useEffect(() => {
    if (!api || listenersSetupRef.current) return;
    
    listenersSetupRef.current = true;

    // Listen for text chunks
    if (api.onChatChunk) {
      api.onChatChunk((chunk) => {
        if (chunk.type === "text" && chunk.content) {
          streamTextRef.current += chunk.content;
          setCurrentStreamText(streamTextRef.current);
        } else if (chunk.type === "done") {
          // Only add message once
          if (!hasAddedMessageRef.current && streamTextRef.current) {
            hasAddedMessageRef.current = true;
            const assistantMessage: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: streamTextRef.current,
              timestamp: new Date(),
            };
            setMessages((msgs) => [...msgs, assistantMessage]);
          }
          // Reset state
          streamTextRef.current = "";
          setCurrentStreamText("");
          setIsStreaming(false);
        } else if (chunk.type === "error") {
          const errorMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: `❌ Erreur: ${chunk.content}`,
            timestamp: new Date(),
          };
          setMessages((msgs) => [...msgs, errorMessage]);
          setIsStreaming(false);
          streamTextRef.current = "";
          setCurrentStreamText("");
        }
      });
    }

    // Listen for tool calls
    if (api.onChatToolCall) {
      api.onChatToolCall((toolCall) => {
        setActiveTools((tools) => [
          ...tools,
          {
            id: toolCall.id,
            name: toolCall.name,
            args: toolCall.args,
            status: "running",
          },
        ]);
      });
    }

    // Listen for tool results
    if (api.onChatToolResult) {
      api.onChatToolResult((result) => {
        setActiveTools((tools) =>
          tools.map((t) =>
            t.id === result.id
              ? { ...t, status: "completed" as const, result: result.result }
              : t
          )
        );
      });
    }

    // Cleanup on unmount
    return () => {
      listenersSetupRef.current = false;
    };
  }, [api]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!api?.streamChat || !projectPath || !content.trim()) return;

      // Reset refs for new message
      streamTextRef.current = "";
      hasAddedMessageRef.current = false;

      // Add user message
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Clear previous stream state
      setCurrentStreamText("");
      setActiveTools([]);
      setIsStreaming(true);

      // Build messages for API
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        await api.streamChat(projectPath, apiMessages);
      } catch (error: any) {
        console.error("Chat error:", error);
        setIsStreaming(false);
      }
    },
    [api, projectPath, messages]
  );

  const abort = useCallback(async () => {
    if (api?.abortChat) {
      await api.abortChat();
      setIsStreaming(false);
      // Keep the partial response
      if (streamTextRef.current) {
        const partialMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: streamTextRef.current + "\n\n_(Interrompu)_",
          timestamp: new Date(),
        };
        setMessages((msgs) => [...msgs, partialMessage]);
        streamTextRef.current = "";
        setCurrentStreamText("");
      }
    }
  }, [api]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setActiveTools([]);
    setCurrentStreamText("");
    streamTextRef.current = "";
    hasAddedMessageRef.current = false;
  }, []);

  return {
    messages,
    activeTools,
    isStreaming,
    currentStreamText,
    sendMessage,
    abort,
    clearHistory,
  };
}
