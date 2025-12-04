# Project Context: Through

## Overview
**Through** is a hybrid desktop application designed to analyze project folders and intelligently launch development servers. It leverages a modern tech stack to combine native performance with a flexible web-based UI.

## Tech Stack & Architecture

*   **Core (Electron 28):**  Serves as the desktop shell and backend (Main process), handling OS-level interactions, IPC communication, and process management.
*   **UI (Next.js 14):**  Provides the frontend interface (Renderer process), running in Vite during development.
*   **Performance (Rust NAPI):**  Native modules (`packages/native`) are used for heavy-lifting tasks like fast file analysis, port scanning, and process management.
*   **Intelligence (OpenAI GPT-4-mini):**  Used to analyze project structures and detect frameworks/commands when heuristics fail.

### Key Architecture Patterns

*   **IPC Communication:** 
    *   Renderer (React) calls `window.electronAPI` (exposed via `preload.ts`).
    *   Main process handles these via `ipcMain.handle`, delegating to services (`ProjectAnalyzer`, `ServerManager`).
    *   Services may call Rust native modules for execution.
*   **Security:**
    *   **Isolation:** Renderer is sandboxed with `contextIsolation: true` and `nodeIntegration: false`.
    *   **Secrets:** `OPENAI_API_KEY` is strictly kept in the Main process (loaded from `.env`).
*   **Caching:** Analysis results are cached in `cache/projects/{hash}.json` (24h TTL) to minimize API costs.

## Directory Structure

```
Through/
├── apps/
│   ├── electron/        # Main process (CommonJS)
│   │   └── src/         # Entry point, IPC handlers, Services
│   └── web/             # Renderer UI (Next.js App Router)
│       └── src/         # Pages, Components, Hooks
├── packages/
│   ├── native/          # Rust NAPI modules (source in src/, cargo config)
│   └── shared/          # Shared TypeScript types (interfaces for Project, Server)
├── cache/               # Git-ignored folder for analysis results
├── .env                 # Environment variables (API Keys) - DO NOT COMMIT
└── package.json         # Root scripts and workspace definitions
```

## Development Workflow

**Note:** Do NOT run `npm run dev` directly at the root without understanding the concurrent setup. Use specific commands for focused tasks.

### Prerequisites
1.  **Node.js 18+** and **Rust toolchain** installed.
2.  **OpenAI API Key** configured in `.env` (copy from `.env.example`).
3.  **Initial Build:** You **must** build the native modules at least once:
    ```bash
    npm run build:native
    ```

### Common Commands

| Task | Command | Description |
| :--- | :--- | :--- |
| **Start All** | `npm run dev` | Runs both Web and Electron watchers concurrently. |
| **Web Only** | `npm run dev:web` | Starts Next.js dev server (Port 49123). |
| **Electron Only** | `npm run dev:electron` | Starts Electron (loads from localhost:49123). |
| **Build Native** | `npm run build:native` | Recompiles Rust modules (Essential after Rust changes). |
| **Type Check** | `npm run typecheck` | Validates TS types across workspaces. |
| **Full Build** | `npm run build` | Builds Native -> Web -> Electron for production. |

### Troubleshooting

*   **"Module @through/native not found":** The Rust modules haven't been built. Run `npm run build:native`.
*   **"OPENAI_API_KEY required":** Ensure `.env` exists in the project root and contains the key.
*   **Port Conflicts:** The app uses port `49123` for the UI. Check if it's in use: `lsof -ti:49123`.
*   **ESLint Errors:** The project has an empty `eslint.config.js`. Ignore linting errors unless you configure it.

## Conventions

*   **Modules:** 
    *   Electron is **CommonJS**.
    *   Next.js/Web is **ESNext**.
    *   Rust uses **NAPI** (cdylib).
*   **Imports:** Use workspace aliases `@through/*` for internal packages and `@/*` for web app imports.
*   **State:** React functional components with hooks.
*   **Error Handling:** Errors in the Main process or Rust should be caught and propagated back to the Renderer via IPC for user visibility.
