/**
 * ChatAgentService - Streaming chat with tool visibility for code editing
 * Uses Vercel AI SDK (compatible with Electron CommonJS)
 */
import { streamText, stepCountIs } from "ai";
import { BrowserWindow } from "electron";
import { getModel, getModelInfo } from "../settings.js";
import * as crypto from "crypto";
import { ChatMessage, Conversation, ToolCallEvent, ToolResultEvent, PendingChange } from "./types.js";
import { ChangeManager } from "./ChangeManager.js";
import { HistoryManager } from "./HistoryManager.js";
import { createTools } from "./tools/index.js";

// Singleton instance
let chatAgentInstance: ChatAgentService | null = null;

export class ChatAgentService {
  private mainWindow: BrowserWindow | null = null;
  private abortController: AbortController | null = null;
  private projectPath: string = "";

  private changeManager: ChangeManager;
  private historyManager: HistoryManager;

  constructor() {
    console.log("🤖 ChatAgentService initialized");

    this.changeManager = new ChangeManager({
      emitPendingChanges: this.emitPendingChanges.bind(this)
    });

    this.historyManager = new HistoryManager({
      emitHistoryUpdate: (conversations) => this.emit("chat:history-updated", conversations)
    });
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      console.log("🛑 Chat aborted");
    }
  }

  // ==================== CHANGE MANAGEMENT DELEGATION ====================

  getPendingChanges(): PendingChange[] {
    return this.changeManager.getPendingChanges();
  }

  async toggleChanges(visible: boolean) {
    return this.changeManager.toggleChanges(visible);
  }

  async validateChanges() {
    return this.changeManager.validateChanges();
  }

  async rejectChanges() {
    return this.changeManager.rejectChanges();
  }

  clearPendingChanges() {
    this.changeManager.clearPendingChanges();
  }

  private emitPendingChanges(changes: PendingChange[]) {
    this.emit("chat:pending-changes", changes);
  }

  // ==================== HISTORY MANAGEMENT DELEGATION ====================

  async getConversations(projectPath: string): Promise<Conversation[]> {
    return this.historyManager.getConversations(projectPath);
  }

  async saveConversation(projectPath: string, conversation: Conversation): Promise<void> {
    return this.historyManager.saveConversation(projectPath, conversation);
  }

  async deleteConversation(projectPath: string, conversationId: string): Promise<void> {
    return this.historyManager.deleteConversation(projectPath, conversationId);
  }

  async generateTitle(messages: ChatMessage[]): Promise<string> {
    return this.historyManager.generateTitle(messages);
  }

  // ==================== EMITTERS ====================

  private emit(channel: string, data: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private emitToolCall(toolCall: ToolCallEvent) {
    this.emit("chat:tool-call", toolCall);
  }

  private emitToolResult(result: ToolResultEvent) {
    this.emit("chat:tool-result", result);
  }

  private emitChunk(chunk: { type: string; content?: string; done?: boolean }) {
    this.emit("chat:chunk", chunk);
  }

  // ==================== CHAT STREAMING ====================

  async streamChat(projectPath: string, messages: ChatMessage[], conversationId?: string): Promise<{ success: boolean; error?: string; conversationId?: string }> {
    this.projectPath = projectPath;
    this.abortController = new AbortController();

    // Setup conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = crypto.randomUUID();
    }

    console.log("💬 Starting chat stream...");
    console.log("📂 Project:", projectPath);
    console.log("🆔 Conversation:", currentConversationId);
    console.log("📝 Messages:", messages.length);

    try {
      const tools = createTools({
        projectPath: this.projectPath,
        emitToolCall: this.emitToolCall.bind(this),
        emitToolResult: this.emitToolResult.bind(this),
        addPendingChange: this.changeManager.addPendingChange.bind(this.changeManager)
      });

      const model = getModel();

      const systemPrompt = `Tu es un assistant de développement IA expert, intégré dans un IDE.

## TOOLS DISPONIBLES (18 outils)

### Lecture
- **readFile**: Lire tout un fichier
- **getLineRange**: Lire des lignes spécifiques (optimisé pour gros fichiers)
- **getFileInfo**: Métadonnées d'un fichier (taille, lignes, date)

### Recherche
- **searchInProject**: Chercher du texte dans tout le projet
- **searchInFile**: Chercher dans un fichier spécifique (avec contexte)
- **searchByRegex**: Recherche par expression régulière
- **findFilesByName**: Trouver des fichiers par nom/pattern

### Structure
- **listFiles**: Lister un répertoire
- **getProjectStructure**: Arborescence complète du projet
- **getPackageInfo**: Lire package.json (dépendances, scripts)

### Écriture
- **writeFile**: Réécrire un fichier entier
- **replaceInFile**: Remplacer un bloc de code (PRÉFÉRÉ - rapide & sûr)
- **insertAtLine**: Insérer à une ligne précise
- **appendToFile**: Ajouter à la fin d'un fichier

### Gestion
- **createFile**: Créer un nouveau fichier
- **deleteFile**: Supprimer un fichier (backup auto)
- **copyFile**: Copier un fichier
- **moveFile**: Déplacer/renommer un fichier

### Système
- **runCommand**: Exécuter une commande shell (npm, git, etc.)

## RÈGLES
1. TOUJOURS lire un fichier AVANT de le modifier
2. Pour gros fichiers: utiliser getFileInfo puis getLineRange
3. Préférer replaceInFile à writeFile pour les modifications
4. Expliquer chaque changement
5. Ne JAMAIS modifier node_modules

## WORKFLOW
1. Comprendre la demande
2. Explorer le projet (listFiles, getProjectStructure)
3. Rechercher le code pertinent (searchInProject, searchInFile)
4. Lire le fichier cible (readFile ou getLineRange)
5. Modifier (replaceInFile ou insertAtLine)
6. Confirmer le changement

Réponds en français sauf si l'utilisateur parle anglais.`;

      const aiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Check if extended thinking is enabled
      const modelInfo = getModelInfo();
      console.log("🧠 Extended Thinking enabled:", modelInfo.extendedThinking);
      console.log("📊 Model:", modelInfo.model?.name, "| Provider:", modelInfo.model?.provider, "| Supports thinking:", modelInfo.model?.supportsThinking);

      // Build streamText options
      const streamOptions: any = {
        model,
        messages: aiMessages,
        tools,
        stopWhen: stepCountIs(25),
        abortSignal: this.abortController.signal,
      };

      // Add extended thinking based on provider
      if (modelInfo.extendedThinking && modelInfo.model?.supportsThinking) {
        const provider = modelInfo.model.provider;

        if (provider === "anthropic") {
          // Anthropic: Use thinking with budget
          streamOptions.providerOptions = {
            anthropic: {
              thinking: {
                type: "enabled",
                budgetTokens: 10000,
              },
            },
          };
          console.log("🧠 Anthropic thinking mode ACTIVATED with 10k token budget");
        }
        else if (provider === "openai") {
          // OpenAI: Use reasoningEffort for o1/o3/o4 models
          streamOptions.providerOptions = {
            openai: {
              reasoningEffort: "medium", // 'low', 'medium', or 'high'
              // reasoningSummary: "auto",  // Requires verified organization
            },
          };
          console.log("🧠 OpenAI reasoning mode ACTIVATED (medium effort)");
        }
        else if (provider === "google") {
          // Google: thinking config if supported
          streamOptions.providerOptions = {
            google: {
              thinkingConfig: {
                thinkingBudget: 10000,
              },
            },
          };
          console.log("🧠 Google thinking mode ACTIVATED with 10k token budget");
        }
      }

      const response = streamText(streamOptions);
      let fullResponseText = "";

      // Use fullStream to capture reasoning/thinking
      for await (const part of response.fullStream) {
        if (this.abortController?.signal.aborted) break;

        // Log all event types for debugging
        if (part.type.includes("reasoning")) {
          console.log("🧠 Reasoning event:", part.type, part);
        }

        switch (part.type) {
          case "reasoning-start":
            console.log("🧠 REASONING START");
            this.emitChunk({ type: "reasoning-start" });
            break;
          case "reasoning-delta":
            if (part.text) {
              console.log("🧠 REASONING:", part.text.substring(0, 50) + "...");
              this.emitChunk({ type: "reasoning", content: part.text });
            }
            break;
          case "reasoning-end":
            console.log("🧠 REASONING END");
            this.emitChunk({ type: "reasoning-end" });
            break;
          case "text-delta":
            if (part.text) {
              fullResponseText += part.text;
              this.emitChunk({ type: "text", content: part.text });
            }
            break;
          case "error":
            console.error("Stream error:", part);
            break;
          default:
            // tool-call and tool-result are handled by the SDK automatically
            break;
        }
      }

      this.emitChunk({ type: "done", done: true });

      // Save conversation at the end
      const fullConversation: Conversation = {
        id: currentConversationId!,
        title: "New Conversation", // Placeholder, will update below if needed
        timestamp: new Date().toISOString(),
        messages: [...aiMessages.filter(m => m.role !== "system"), { role: "assistant", content: fullResponseText }] as ChatMessage[]
      };

      // Retrieve existing if possible to keep title
      try {
        const existingList = await this.getConversations(projectPath);
        const existing = existingList.find(c => c.id === currentConversationId);
        if (existing) {
          fullConversation.title = existing.title;
          // Merge messages properly (the input 'messages' might be user's view, we should trust it but ensure we append the new assistant one)
          // Actually, 'messages' passed in IS the full history minus the new response.
        } else {
          // Generate title for new conversation
          if (messages.length > 0) {
            fullConversation.title = await this.generateTitle(messages);
          }
        }
      } catch (e) { console.error(e); }

      await this.saveConversation(projectPath, fullConversation);

      return { success: true, conversationId: currentConversationId };
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("🛑 Chat aborted");
        return { success: true };
      }
      console.error("❌ Chat error:", error);
      this.emitChunk({ type: "error", content: error.message });
      return { success: false, error: error.message };
    } finally {
      this.abortController = null;
    }
  }
}

export function getChatAgentService(): ChatAgentService {
  if (!chatAgentInstance) {
    chatAgentInstance = new ChatAgentService();
  }
  return chatAgentInstance;
}
