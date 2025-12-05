"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useElectronAPI } from "@/hooks/useElectronAPI";

// A segment can be either text or a tool call
export interface MessageSegment {
  type: "text" | "tool";
  content?: string;
  toolCall?: ToolCall;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;  // Full text for user messages, empty for assistant (use segments)
  isStreaming?: boolean;
  segments?: MessageSegment[];  // Ordered list of text and tool segments
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "running" | "completed" | "error";
}

interface StreamChunk {
  type: "text" | "tool-call" | "tool-result" | "step" | "done" | "error";
  content?: string;
  toolCall?: ToolCall;
  stepNumber?: number;
  error?: string;
}

export function useChatAgent(projectPath: string) {
  const { api } = useElectronAPI();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);

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
    setCurrentStep(0);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isStreaming: true,
      segments: [],
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);

    const cleanup = api.onChatChunk((chunk: StreamChunk) => {
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.role !== "assistant") return prev;

        const updated = { ...lastMessage };
        const segments = [...(updated.segments || [])];

        switch (chunk.type) {
          case "text":
            if (chunk.content) {
              // Find last text segment or create new one
              const lastSegment = segments[segments.length - 1];
              if (lastSegment && lastSegment.type === "text") {
                lastSegment.content = (lastSegment.content || "") + chunk.content;
              } else {
                segments.push({ type: "text", content: chunk.content });
              }
              updated.content += chunk.content;
            }
            break;

          case "tool-call":
            if (chunk.toolCall) {
              // Add tool as new segment
              segments.push({ 
                type: "tool", 
                toolCall: { ...chunk.toolCall, status: "running" }
              });
            }
            break;

          case "tool-result":
            if (chunk.toolCall) {
              // Find and update the tool segment
              for (let i = segments.length - 1; i >= 0; i--) {
                const seg = segments[i];
                if (seg.type === "tool" && seg.toolCall?.name === chunk.toolCall.name) {
                  seg.toolCall = { ...seg.toolCall, ...chunk.toolCall, status: "completed" };
                  break;
                }
              }
            }
            break;

          case "step":
            if (chunk.stepNumber) {
              setCurrentStep(chunk.stepNumber);
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

        updated.segments = segments;
        return [...prev.slice(0, -1), updated];
      });

      if (chunk.type === "done" || chunk.type === "error") {
        setIsStreaming(false);
      }
    });

    cleanupRef.current = cleanup;

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
    setCurrentStep(0);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    currentStep,
    sendMessage,
    clearMessages,
  };
}
