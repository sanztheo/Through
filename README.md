<div align="center">
  <img src="apps/electron/assets/icons/512x512.png" alt="Through Logo" width="120" style="border-radius: 24px">
</div>

# Through 🚀

> **Analyze project folders and launch development servers intelligently.**

**Through** is a powerful hybrid desktop application that combines the raw performance of **Rust** native modules with the flexibility of a modern web UI. It streamlines your development workflow by automatically detecting project types, analyzing structures, and managing development servers with ease.

---

## ✨ Features

- 🕵️ **Smart Analysis**: Automatically detects frameworks, languages, and project structures using **OpenAI, Anthropic (Claude), Google (Gemini)** and advanced heuristic algorithms.
- 🚀 **One-Click Launch**: Instantly starts development servers for any detected project.
- ⚡ **Native Performance**: Heavy lifting is handled by **Rust (NAPI)** modules for specific OS-level operations and blazing fast performance.
- 🖥️ **Modern UI**: A beautiful, responsive interface built with **Next.js 14** and styled for a premium developer experience.
- 🔒 **Secure & Local**: Sandboxed environment with local caching—your data stays yours.

## 🛠️ Tech Stack

This project is built with a cutting-edge stack designed for performance and scalability:

- **Core**: [Electron](https://www.electronjs.org/) (Desktop shell & Main process)
- **Frontend**: [Next.js 14](https://nextjs.org/) (React, TypeScript, Tailwind CSS)
- **Performance**: [Rust](https://www.rust-lang.org/) (NAPI-RS for native Node.js extensions)
- **Intelligence**: **Multi-Provider AI** (OpenAI, Anthropic, Google Gemini)

## 📁 Project Structure

```bash
Through/
├── apps/
│   ├── electron/     # 🖥️ Main process & Desktop integration
│   └── web/          # 🎨 Renderer UI (Next.js)
├── packages/
│   ├── native/       # 🦀 Rust modules (High performance)
│   └── shared/       # 📦 Shared Types & Utilities
└── cache/            # 💾 Local analysis cache
```

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+**
- **Rust Toolchain** (Cargo)
- **AI API Keys** (OpenAI, Anthropic, Gemini, etc.)

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/your-username/through.git
    cd through
    ```

2.  **Configure Environment**
    Copy the example environment file:

    ```bash
    cp .env.example .env
    ```

    _Open `.env` and add your API keys (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`)._\_

3.  **Install Dependencies**

    ```bash
    npm install
    ```

4.  **Build Native Modules** (Required first step)
    ```bash
    npm run build:native
    ```

### Development

Start both the Electron app and the web development server concurrently:

```bash
npm run dev
```

---

## ⚖️ License & Legal Information

**© Sanz - All Rights Reserved.**

This software and its source code are the exclusive private property of **Sanz**.

### 🚫 Commercial Use Prohibited / Usage Commercial Interdit

**English:**
Strictly **NO commercial use** of this software, its source code, or any derivatives is allowed without explicit written permission from the owner. You are not permitted to sell, rent, lease, distribute, or monetize this project in any way.

**Français:**
L'utilisation commerciale de ce logiciel, de son code source ou de tout dérivé est **strictement interdite** sans l'autorisation écrite explicite du propriétaire. Il est interdit de vendre, louer, distribuer ou monétiser ce projet de quelque manière que ce soit.

### 💼 Contact for Licenses / Contact

For all commercial inquiries, licensing requests, or permissions, you **MUST** contact the owner directly:
Pour toute demande commerciale ou d'autorisation, vous **DEVEZ** contacter le propriétaire directement :

📧 **Email**: [sanztheopro@gmail.com](mailto:sanztheopro@gmail.com)
