"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// Unified timeline item types
export type TimelineItem = 
  | { type: "user-message"; id: string; content: string; timestamp: Date }
  | { type: "assistant-message"; id: string; content: string; timestamp: Date }
  | { type: "tool-call"; id: string; name: string; args: Record<string, any>; status: "running" | "completed" | "error"; result?: any; timestamp: Date };

interface ElectronAPI {
  streamChat?: (projectPath: string, messages: Array<{ role: string; content: string }>) => Promise<any>;
  onChatChunk?: (callback: (chunk: any) => void) => () => void;
  onChatToolCall?: (callback: (toolCall: { id: string; name: string; args: any }) => void) => () => void;
  onChatToolResult?: (callback: (result: { id: string; name: string; result: any }) => void) => () => void;
  abortChat?: () => Promise<void>;
}

export function useChatAgent(api: ElectronAPI | null, projectPath: string | null) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState("");
  
  // Refs to track state without closure issues
  const streamTextRef = useRef("");
  const currentMessageIdRef = useRef<string | null>(null);
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
          // Finalize the current message if there's content
          if (streamTextRef.current && currentMessageIdRef.current) {
            const finalContent = streamTextRef.current;
            const messageId = currentMessageIdRef.current;
            
            setTimeline((prev) => {
              // Check if this message already exists
              const exists = prev.some(item => item.id === messageId);
              if (exists) {
                // Update existing message
                return prev.map(item => 
                  item.id === messageId && item.type === "assistant-message"
                    ? { ...item, content: finalContent }
                    : item
                );
              } else {
                // Add new message
                return [...prev, {
                  type: "assistant-message" as const,
                  id: messageId,
                  content: finalContent,
                  timestamp: new Date(),
                }];
              }
            });
          }
          
          // Reset state
          streamTextRef.current = "";
          currentMessageIdRef.current = null;
          setCurrentStreamText("");
          setIsStreaming(false);
        } else if (chunk.type === "error") {
          setTimeline((prev) => [...prev, {
            type: "assistant-message",
            id: `error-${Date.now()}`,
            content: `❌ Erreur: ${chunk.content}`,
            timestamp: new Date(),
          }]);
          setIsStreaming(false);
          streamTextRef.current = "";
          currentMessageIdRef.current = null;
          setCurrentStreamText("");
        }
      });
    }

    // Listen for tool calls
    if (api.onChatToolCall) {
      api.onChatToolCall((toolCall) => {
        // First, save any pending text as a message
        if (streamTextRef.current) {
          const pendingText = streamTextRef.current;
          const messageId = currentMessageIdRef.current || `msg-${Date.now()}`;
          
          setTimeline((prev) => {
            const exists = prev.some(item => item.id === messageId);
            if (!exists) {
              return [...prev, {
                type: "assistant-message" as const,
                id: messageId,
                content: pendingText,
                timestamp: new Date(),
              }];
            }
            return prev.map(item =>
              item.id === messageId && item.type === "assistant-message"
                ? { ...item, content: pendingText }
                : item
            );
          });
          
          // Reset for next message segment
          streamTextRef.current = "";
          setCurrentStreamText("");
        }
        
        // Add the tool call to timeline
        setTimeline((prev) => [...prev, {
          type: "tool-call",
          id: toolCall.id,
          name: toolCall.name,
          args: toolCall.args,
          status: "running",
          timestamp: new Date(),
        }]);
        
        // Prepare for new message after tool
        currentMessageIdRef.current = `msg-${Date.now()}`;
      });
    }

    // Listen for tool results
    if (api.onChatToolResult) {
      api.onChatToolResult((result) => {
        setTimeline((prev) =>
          prev.map((item) =>
            item.type === "tool-call" && item.id === result.id
              ? { ...item, status: "completed" as const, result: result.result }
              : item
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

      // Reset refs for new conversation turn
      streamTextRef.current = "";
      currentMessageIdRef.current = `msg-${Date.now()}`;

      // Add user message to timeline
      setTimeline((prev) => [...prev, {
        type: "user-message",
        id: `user-${Date.now()}`,
        content: content.trim(),
        timestamp: new Date(),
      }]);

      // Clear previous stream state
      setCurrentStreamText("");
      setIsStreaming(true);

      // Build messages for API from timeline
      const messages = timeline
        .filter(item => item.type === "user-message" || item.type === "assistant-message")
        .map(item => ({
          role: item.type === "user-message" ? "user" : "assistant",
          content: item.content,
        }));
      
      // Add current user message
      messages.push({ role: "user", content: content.trim() });

      try {
        await api.streamChat(projectPath, messages);
      } catch (error: any) {
        console.error("Chat error:", error);
        setIsStreaming(false);
      }
    },
    [api, projectPath, timeline]
  );

  const abort = useCallback(async () => {
    if (api?.abortChat) {
      await api.abortChat();
      setIsStreaming(false);
      
      // Keep any partial response
      if (streamTextRef.current) {
        setTimeline((prev) => [...prev, {
          type: "assistant-message",
          id: `partial-${Date.now()}`,
          content: streamTextRef.current + "\n\n_(Interrompu)_",
          timestamp: new Date(),
        }]);
        streamTextRef.current = "";
        currentMessageIdRef.current = null;
        setCurrentStreamText("");
      }
    }
  }, [api]);

  const clearHistory = useCallback(() => {
    setTimeline([]);
    setCurrentStreamText("");
    streamTextRef.current = "";
    currentMessageIdRef.current = null;
  }, []);

  return {
    timeline,
    isStreaming,
    currentStreamText,
    sendMessage,
    abort,
    clearHistory,
  };
}
