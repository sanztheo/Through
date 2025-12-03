# Through

Desktop application that analyzes project folders and launches development servers intelligently.

## Tech Stack

- **Electron** - Desktop wrapper
- **Next.js** - Frontend UI
- **Rust (NAPI)** - Native modules for performance-critical operations
- **OpenAI GPT-4-mini** - Project analysis

## Features

### MVP (Phase 1)
- ✅ Folder selection and analysis
- ✅ Automatic project type detection
- ✅ Server launch and localhost display

### Future (Phase 2)
- 🔜 Visual DOM/CSS inspection
- 🔜 Live code modification

## Setup

### Prerequisites

- Node.js 18+
- Rust toolchain
- OpenAI API key

### Installation

1. Clone the repository
2. Copy environment template:
   ```bash
   cp .env.example .env
   ```

3. Add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=sk-proj-your-key-here
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Build native modules:
   ```bash
   npm run build:native
   ```

### Development

```bash
npm run dev
```

This starts:
- Next.js dev server (UI)
- Electron app with hot reload

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
Through/
├── apps/
│   ├── electron/     # Electron main process
│   └── web/          # Next.js frontend
├── packages/
│   ├── native/       # Rust NAPI modules
│   └── shared/       # Shared TypeScript types
└── cache/            # Project analysis cache
```

## Security

- ⚠️ **Never commit `.env` file**
- ✅ API keys are only accessible in Electron main process
- ✅ Renderer process is sandboxed and isolated
- ✅ Cache directory has restricted permissions

## License

MIT
