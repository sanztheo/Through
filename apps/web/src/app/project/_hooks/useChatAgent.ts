"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// Unified timeline item types
export type TimelineItem = 
  | { type: "user-message"; id: string; content: string; timestamp: Date }
  | { type: "assistant-message"; id: string; content: string; timestamp: Date }
  | { type: "thinking"; id: string; content: string; timestamp: Date }
  | { type: "tool-call"; id: string; name: string; args: Record<string, any>; status: "running" | "completed" | "error"; result?: any; timestamp: Date };

// Pending change for file modifications
export interface PendingChange {
  id: string;
  type: "create" | "modify" | "delete";
  filePath: string;
  backupPath?: string;
  timestamp: Date;
}

export interface AppSettings {
  aiModel: string;
  defaultClonePath: string;
  extendedThinking: boolean;
}

export interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportsThinking: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  timestamp: string;
  messages: any[];
}

interface ElectronAPI {
  streamChat?: (projectPath: string, messages: Array<{ role: string; content: string }>, conversationId?: string) => Promise<{ success: boolean; conversationId?: string }>;
  onChatChunk?: (callback: (chunk: any) => void) => () => void;
  onChatToolCall?: (callback: (toolCall: { id: string; name: string; args: any }) => void) => () => void;
  onChatToolResult?: (callback: (result: { id: string; name: string; result: any }) => void) => () => void;
  onPendingChanges?: (callback: (changes: PendingChange[]) => void) => () => void;
  onHistoryUpdated?: (callback: (conversations: ConversationSummary[]) => void) => () => void;
  abortChat?: () => Promise<void>;
  validateChanges?: () => Promise<{ success: boolean }>;
  rejectChanges?: () => Promise<{ success: boolean }>;
  clearPendingChanges?: () => Promise<{ success: boolean }>;
  getHistory?: (projectPath: string) => Promise<ConversationSummary[]>;
  deleteConversation?: (params: { projectPath: string; conversationId: string }) => Promise<void>;
  getSettings?: () => Promise<AppSettings>;
  saveSettings?: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getModels?: () => Promise<ModelDefinition[]>;
}

export function useChatAgent(api: ElectronAPI | null, projectPath: string | null) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelDefinition[]>([]);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState("");
  const [currentThinkingText, setCurrentThinkingText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  
  // Refs to track state without closure issues
  const streamTextRef = useRef("");
  const thinkingTextRef = useRef("");
  const currentMessageIdRef = useRef<string | null>(null);
  const currentThinkingIdRef = useRef<string | null>(null);
  const listenersSetupRef = useRef(false);

  // Setup listeners only once when API becomes available
  useEffect(() => {
    if (!api || listenersSetupRef.current) return;
    
    listenersSetupRef.current = true;

    // Listen for text chunks
    if (api.onChatChunk) {
      api.onChatChunk((chunk) => {
        // Handle reasoning/thinking
        if (chunk.type === "reasoning-start") {
          console.log("🧠 Frontend: REASONING START");
          setIsThinking(true);
          thinkingTextRef.current = "";
          currentThinkingIdRef.current = `thinking-${Date.now()}`;
          setCurrentThinkingText("");
        } else if (chunk.type === "reasoning" && chunk.content) {
          thinkingTextRef.current += chunk.content;
          setCurrentThinkingText(thinkingTextRef.current);
        } else if (chunk.type === "reasoning-end") {
          // Capture the final content before any state changes
          const finalThinkingContent = thinkingTextRef.current;
          const thinkingId = currentThinkingIdRef.current;
          
          console.log("🧠 Frontend: REASONING END");
          console.log("🧠 Frontend: Content length:", finalThinkingContent.length);
          console.log("🧠 Frontend: Content preview:", finalThinkingContent.substring(0, 100));
          
          // Save thinking to timeline with captured content
          if (finalThinkingContent && thinkingId) {
            setTimeline((prev) => [...prev, {
              type: "thinking" as const,
              id: thinkingId,
              content: finalThinkingContent,
              timestamp: new Date(),
            }]);
            console.log("🧠 Frontend: Added thinking to timeline");
          } else {
            console.log("🧠 Frontend: No content to save!");
          }
          
          setIsThinking(false);
          thinkingTextRef.current = "";
          currentThinkingIdRef.current = null;
          setCurrentThinkingText("");
        }
        // Handle regular text
        else if (chunk.type === "text" && chunk.content) {
          streamTextRef.current += chunk.content;
          setCurrentStreamText(streamTextRef.current);
        } else if (chunk.type === "done") {
          // Finalize the current message if there's content
          if (streamTextRef.current && currentMessageIdRef.current) {
            const finalContent = streamTextRef.current;
            const messageId = currentMessageIdRef.current;
            
            setTimeline((prev) => {
              const exists = prev.some(item => item.id === messageId);
              if (exists) {
                return prev.map(item => 
                  item.id === messageId && item.type === "assistant-message"
                    ? { ...item, content: finalContent }
                    : item
                );
              } else {
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
          setIsThinking(false);
        } else if (chunk.type === "error") {
          setTimeline((prev) => [...prev, {
            type: "assistant-message",
            id: `error-${Date.now()}`,
            content: `❌ Erreur: ${chunk.content}`,
            timestamp: new Date(),
          }]);
          setIsStreaming(false);
          setIsThinking(false);
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

    // Listen for pending changes
    if (api.onPendingChanges) {
      api.onPendingChanges((changes) => {
        setPendingChanges(changes);
      });
    }

    // Listen for history updates
    if (api.onHistoryUpdated) {
      api.onHistoryUpdated((list) => {
        setConversations(list);
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
      thinkingTextRef.current = "";
      currentMessageIdRef.current = `msg-${Date.now()}`;
      currentThinkingIdRef.current = null;

      // Add user message to timeline
      setTimeline((prev) => [...prev, {
        type: "user-message",
        id: `user-${Date.now()}`,
        content: content.trim(),
        timestamp: new Date(),
      }]);

      // Clear previous stream state
      setCurrentStreamText("");
      setCurrentThinkingText("");
      setIsStreaming(true);
      setIsThinking(false);

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
        const result = await api.streamChat(projectPath, messages, currentConversationId || undefined);
        if (result.success && result.conversationId && !currentConversationId) {
          setCurrentConversationId(result.conversationId);
        }
      } catch (error: any) {
        console.error("Chat error:", error);
        setIsStreaming(false);
        setIsThinking(false);
      }
    },
    [api, projectPath, timeline, currentConversationId]
  );

  const abort = useCallback(async () => {
    if (api?.abortChat) {
      await api.abortChat();
      setIsStreaming(false);
      setIsThinking(false);
      
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
    setCurrentThinkingText("");
    streamTextRef.current = "";
    thinkingTextRef.current = "";
    currentMessageIdRef.current = null;
    currentThinkingIdRef.current = null;
    setIsThinking(false);
  }, []);

  // Validate all pending changes (keep modifications)
  const validatePendingChanges = useCallback(async () => {
    if (!api?.validateChanges) return;
    await api.validateChanges();
  }, [api]);

  // Reject all pending changes (restore from backups)
  const rejectPendingChanges = useCallback(async () => {
    if (!api?.rejectChanges) return;
    await api.rejectChanges();
  }, [api]);

  // Clear pending changes without action
  const dismissPendingChanges = useCallback(async () => {
    if (!api?.clearPendingChanges) return;
    await api.clearPendingChanges();
  }, [api]);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!api?.getHistory || !projectPath) return;
    const history = await api.getHistory(projectPath);
    setConversations(history);
  }, [api, projectPath]);

  // Initial load
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Load specific conversation
  const loadConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    setCurrentConversationId(conversationId);
    
    // Transform to timeline items
    const newTimeline: TimelineItem[] = conversation.messages.map((msg, index) => {
      if (msg.role === "user") {
        return {
          type: "user-message",
          id: `msg-${index}`,
          content: msg.content,
          timestamp: new Date(msg.createdAt || conversation.timestamp),
        };
      } else {
        return {
          type: "assistant-message",
          id: `msg-${index}`,
          content: msg.content,
          timestamp: new Date(msg.createdAt || conversation.timestamp),
        };
      }
    });

    setTimeline(newTimeline);
  }, [conversations]);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setTimeline([]);
    setCurrentStreamText("");
    setCurrentThinkingText("");
    streamTextRef.current = "";
    thinkingTextRef.current = "";
    currentMessageIdRef.current = null;
    currentThinkingIdRef.current = null;
    setIsThinking(false);
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!api?.deleteConversation || !projectPath) return;
    await api.deleteConversation({ projectPath, conversationId });
    if (currentConversationId === conversationId) {
      startNewConversation();
    }
  }, [api, projectPath, currentConversationId, startNewConversation]);

  // Load settings and models
  const loadSettingsAndModels = useCallback(async () => {
    if (!api?.getSettings) return;
    
    try {
      const result = await api.getSettings() as any;
      // Handle legacy/combined format (SettingsModal compatibility)
      if (result && result.settings) {
        setSettings(result.settings);
      } else {
        setSettings(result);
      }
      
      // Get models separately or from result
      if (result && result.models) {
        setAvailableModels(result.models);
      } else if (api.getModels) {
        const models = await api.getModels();
        setAvailableModels(models);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }, [api]);

  // Initial load of settings
  useEffect(() => {
    loadSettingsAndModels();
  }, [loadSettingsAndModels]);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    if (!api?.saveSettings) return;
    const updated = await api.saveSettings(newSettings);
    setSettings(updated);
  }, [api]);

  return {
    timeline,
    isStreaming,
    isThinking,
    currentStreamText,
    currentThinkingText,
    pendingChanges,
    sendMessage,
    abort,
    clearHistory,
    validatePendingChanges,
    rejectPendingChanges,
    dismissPendingChanges,
    conversations,
    currentConversationId,
    loadHistory,
    loadConversation,
    startNewConversation,
    deleteConversation,
    settings,
    availableModels,
    updateSettings,
  };
}
