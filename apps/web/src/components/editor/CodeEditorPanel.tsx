"use client";

import React, { useCallback } from "react";
import Editor from "@monaco-editor/react";
import { EditorTabs, EditorTab } from "./EditorTabs";
import { getLanguageFromFilename } from "./FileIcon";

interface CodeEditorPanelProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onContentChange: (tabId: string, content: string) => void;
  onSave: (tabId: string) => void;
}

export function CodeEditorPanel({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onContentChange,
  onSave,
}: CodeEditorPanelProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleEditorDidMount = useCallback(
    (editor: any, monaco: any) => {
      // Add Cmd+S / Ctrl+S shortcut
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (activeTabId) {
          onSave(activeTabId);
        }
      });
    },
    [activeTabId, onSave],
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Editor Tabs */}
      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
      />

      {/* Monaco Editor */}
      {activeTab ? (
        <div className="flex-1">
          <Editor
            height="100%"
            language={getLanguageFromFilename(activeTab.filename)}
            value={activeTab.content}
            theme="vs-light"
            onChange={(value) => {
              if (value !== undefined) {
                onContentChange(activeTab.id, value);
              }
            }}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 13,
              fontFamily: "'Fira Code', 'Menlo', monospace",
              fontLigatures: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              lineNumbers: "on",
              renderLineHighlight: "line",
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 10 },
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              formatOnPaste: true,
              formatOnType: true,
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Select a file to edit
        </div>
      )}
    </div>
  );
}
