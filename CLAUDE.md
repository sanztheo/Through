# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Framework Architecture

**Through** is a hybrid desktop application that analyzes project folders and launches development servers intelligently.

**Stack**:
- **Electron 28** - Main process (Node.js backend)
- **Next.js 14** - Renderer UI (port 3001) running in Vite
- **Rust NAPI** - Native modules for performance-critical operations
- **OpenAI GPT-4-mini** - Intelligent project detection via API

**Critical constraint**: Do NOT run `npm run dev` directly at the root. Use workspace-specific commands.

## Development Commands

### Standard Workflow
```bash
# Type checking (always run before committing)
npm run typecheck

# Individual workspace development
npm run dev:web          # Next.js only (port 3001)
npm run dev:electron     # Electron only (loads from :3001)

# Building
npm run build:native     # Rust NAPI (required first time)
npm run build:web        # Next.js
npm run build:electron   # Electron main process
npm run build            # All three in sequence

# Production
npm start                # Launch built Electron app

# Cleanup
npm run clean            # All workspaces
npm run clean:native     # Rust target/ only
```

### Rust Native Module Development
```bash
cd packages/native
npm run build            # Release build
npm run build:debug      # Debug build with symbols
```

## Project Structure

### Workspace Organization
```
Through/
├── apps/
│   ├── electron/        # Main process (CommonJS)
│   │   └── src/
│   │       ├── main.ts           # App entry, window creation
│   │       ├── preload.ts        # Context bridge API
│   │       ├── ipc/              # IPC handler registration
│   │       │   ├── project.ts    # Project analysis handlers
│   │       │   ├── server.ts     # Server launch handlers
│   │       │   ├── filesystem.ts # File system handlers
│   │       │   └── browserview.ts# WebView handlers
│   │       ├── services/         # Business logic services
│   │       │   ├── ProjectAnalyzer.ts  # OpenAI integration
│   │       │   ├── CacheManager.ts     # JSON cache (24h TTL)
│   │       │   ├── ServerManager.ts    # Process management
│   │       │   └── OpenAIClient.ts     # API client wrapper
│   │       └── utils/
│   │           └── config.ts     # Environment validation
│   │
│   └── web/             # Renderer UI (ESNext)
│       └── src/
│           ├── app/              # Next.js App Router
│           │   ├── page.tsx      # Main page
│           │   └── project/      # Project analysis views
│           ├── components/       # React components
│           ├── hooks/            # React hooks
│           ├── types/            # TypeScript types
│           └── lib/              # Utilities
│
├── packages/
│   ├── native/          # Rust NAPI bindings
│   │   └── src/
│   │       ├── lib.rs            # NAPI exports
│   │       ├── file_analyzer.rs  # Fast file scanning
│   │       ├── process_manager.rs# Native process control
│   │       └── port_scanner.rs   # Port detection
│   │
│   └── shared/          # Cross-workspace types
│       └── src/types/
│           ├── project.ts        # Project analysis types
│           └── server.ts         # Server management types
│
└── cache/               # Analysis cache (gitignored)
    └── projects/        # Per-project JSON files
```

## Key Architecture Patterns

### IPC Communication Flow
1. **Renderer** (React) → `window.electronAPI.*` (preload)
2. **Preload** → `ipcRenderer.invoke()` → Main process
3. **Main** → IPC handler → Service layer
4. **Service** → Rust native modules (when needed)
5. **Response** flows back through the chain

Example: Project analysis flow
```
page.tsx → window.electronAPI.analyzeProject(path)
  → preload.ts → ipcMain.handle('project:analyze')
  → project.ts handler → ProjectAnalyzer.analyze()
  → file_analyzer.rs (Rust) + OpenAI API
  → CacheManager stores result → returns to renderer
```

### Security Model
- **Node integration**: Disabled in renderer
- **Context isolation**: Enabled with curated API via preload
- **Sandbox**: Enabled for renderer process
- **WebView**: Enabled via `webviewTag: true` for localhost display
- **API Keys**: Only accessible in main process via `.env`

### OpenAI Integration
- **Service**: `OpenAIClient.ts` wraps API calls
- **Cache**: `CacheManager.ts` stores results in `cache/projects/{hash}.json`
- **TTL**: 24 hours by default
- **Model**: GPT-4-mini for project type detection
- **Environment**: Requires `OPENAI_API_KEY` in `.env` file

### Native Module Usage
The Rust NAPI modules are imported as `@through/native`:
```typescript
import { analyzeFiles, scanPort, killProcess } from '@through/native';
```

**When to use native modules**:
- File system operations requiring speed (use `analyzeFiles`)
- Process management (use `killProcess`)
- Port scanning (use `scanPort`)

**When to use Node.js**:
- Simple file reads/writes
- OpenAI API calls
- JSON cache operations

## Important Constraints

### Framework-Specific
- **Next.js**: App Router only (no Pages Router)
- **Electron**: CommonJS module system (`module: "commonjs"`)
- **Web**: ESNext module system (`module: "esnext"`)
- **Rust**: cdylib for NAPI interop

### Development Workflow
1. **First time setup**: Must run `npm run build:native` before anything else
2. **Rust changes**: Require rebuild (`npm run build:native`) + Electron restart
3. **Electron main changes**: Require rebuild (`npm run build:electron`) + restart
4. **Next.js changes**: Hot reload automatically
5. **Type checking**: Always run `npm run typecheck` before git commit

### Environment Setup
Required `.env` file in root:
```
OPENAI_API_KEY=sk-proj-...
```

Never commit `.env` - it's gitignored. Use `.env.example` as template.

## Testing & Validation

### Type Checking
```bash
npm run typecheck  # Checks electron + web workspaces
```

### Manual Testing Flow
1. Select a project folder via native dialog
2. Verify analysis result (framework, commands detected)
3. Launch detected dev server
4. Verify server process running
5. Check localhost URL displayed in WebView

### Common Issues
- **"Module @through/native not found"**: Run `npm run build:native`
- **"OPENAI_API_KEY environment variable is required"**: Check `.env` exists
- **Port 3001 conflict**: Kill existing Next.js: `lsof -ti:3001 | xargs kill`
- **ESLint errors**: Ignore (no ESLint config present, faux positifs)

## Code Style Notes

- **Imports**: Use workspace aliases (`@through/*` for packages, `@/*` for web)
- **TypeScript**: Strict mode enabled in all workspaces
- **React**: Functional components only, hooks pattern
- **Error handling**: Always propagate errors to renderer via IPC
- **Logging**: Use `console.log` in main process (visible in terminal)

## Future Architecture (Phase 2)

Planned but not yet implemented:
- Visual DOM/CSS inspection via DevTools integration
- Live code modification through file system watching
- Enhanced WebView with element selection

Do not implement Phase 2 features unless explicitly requested.
- @CLAUDE.md
- Arrete de lancer le projet juste tu build rien de plus