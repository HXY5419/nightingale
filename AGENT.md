# Nightingale — Agent Guide

## Project Overview

Nightingale is a karaoke application that scans music folders/Jellyfin/Navidrome servers, separates vocals from instrumentals via ML models (UVR/Demucs), transcribes lyrics with word-level timestamps (WhisperX), and plays back with synchronized highlighting, pitch scoring, key/tempo controls, profiles, and dynamic backgrounds.

**Version:** 0.9.1  
**License:** GPL-3.0-or-later  
**Repository:** https://github.com/rzru/nightingale

---

## Architecture (Workspace Monorepo)

The project is a Cargo workspace with 4 members, plus a frontend (Vite + React + Tauri):

| Member | Path | Language | Purpose |
|---|---|---|---|
| `app-core` | `app-core/` | Rust | Shared library: config, scanner, analyzer, playback, library DB, media server clients, lyrics, profiles |
| Tauri app | `client/src-tauri/` | Rust | Tauri desktop shell: IPC bridge, window management, native features |
| Server | `client/src-server/` | Rust | Self-hosted web server (Tauri-free mode): serves frontend, runs analysis, streams audio |
| xtask | `xtask/` | Rust | Build tasks and automation |
| Frontend | `client/` | TypeScript/React | Vite + React + Tailwind CSS v4 UI |

---

## Tech Stack

### Backend (Rust)
- **Edition:** 2024
- **Key crates:** serde, rusqlite (bundled SQLite), ureq (HTTP), lofty (audio metadata), tiny_http (server), chacha20poly1305 (encryption), ts-rs (TypeScript type generation)
- **Python bridge:** The analyzer spawns Python scripts (`app-core/analyzer/`) for ML inference (UVR, Demucs, WhisperX)

### Frontend (TypeScript/React)
- **Framework:** React 19 + TypeScript 5.8
- **Build:** Vite 8 + @vitejs/plugin-react
- **Styling:** Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **UI Components:** Base UI React, Radix UI, shadcn-style components
- **State:** Jotai (lightweight state), TanStack React Query (server state), React Router v7
- **3D/Visuals:** Three.js, @react-three/fiber (shader backgrounds)
- **Format/Lint:** oxlint, oxfmt (no ESLint, no Prettier)
- **Package Manager:** pnpm (workspace)
- **Path alias:** `@/` → `src/`

### Desktop
- **Tauri v2** (Rust backend + webview frontend)
- **Desktop-only features:** system tray, window decorations, native menus, file dialogs, updater
- **Tauri plugins:** dialog, opener, os, process, updater

---

## Directory Structure

```
nightingale-master/
├── app-core/                   # Rust shared library
│   ├── analyzer/               # Python scripts for ML pipeline
│   │   ├── transcribe.py       # WhisperX transcription
│   │   ├── stems.py            # Stem separation (UVR/Demucs)
│   │   ├── pipeline.py         # Orchestration
│   │   ├── server.py           # Python analysis server
│   │   ├── align.py            # Forced alignment
│   │   └── ...
│   └── src/
│       ├── library_db/         # SQLite database layer
│       ├── source/             # Media sources (folder, Jellyfin, Navidrome)
│       ├── lib.rs              # Public API
│       └── ...                 # Config, scanner, lyrics, playback, etc.
│
├── client/                     # Frontend + Tauri wrappers
│   ├── src/                    # React application
│   │   ├── bridge/             # Backend IPC bridge (Tauri + web fallbacks)
│   │   ├── components/         # UI components
│   │   │   ├── menu/           # Menu/sidebar screens
│   │   │   ├── playback/       # Playback screen components
│   │   │   ├── ui/             # Shared UI primitives
│   │   │   └── ...
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utility libraries
│   │   ├── mutations/          # TanStack Query mutations
│   │   ├── pages/              # Route pages
│   │   ├── queries/            # TanStack Query queries
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Utility functions
│   ├── src-tauri/              # Tauri desktop shell (Rust)
│   ├── src-server/             # Self-hosted web server (Rust)
│   └── ...
│
├── site/                       # Marketing site (Astro) + docs (mdbook)
│   ├── docs/                   # mdbook documentation
│   └── src/                    # Astro marketing site
│
├── docker/                     # Docker configuration
├── scripts/                    # Deployment scripts
└── xtask/                      # Build automation
```

---

## Key Conventions

### Code Style
- **Rust:** Use `cargo fmt` (rustfmt). Edition 2024. Follow clippy.
- **TypeScript/React:** Use `oxfmt` for formatting, `oxlint` for linting. No Prettier/ESLint.
- **Imports (TS):** Use `@/` path alias for `src/` imports.
- **No unused variables/parameters** — `tsconfig` has `noUnusedLocals` and `noUnusedParameters` enabled.

### IPC Bridge Pattern
The `client/src/bridge/` directory contains the IPC layer. Each module exports functions that abstract over Tauri invoke calls vs. web fallbacks (HTTP to the self-hosted server). Files like `playback.ts` / `playback.tauri.ts` use platform-specific implementations.

### UI Components
- Components use `class-variance-authority` (cva) and `clsx` for class composition.
- Styling follows Tailwind v4 utility classes.
- UI primitives are in `client/src/components/ui/`.

### Analysis Pipeline
- Python scripts in `app-core/analyzer/` handle ML inference.
- The Rust side spawns Python via `analyzer.rs` and communicates through the Python analysis server (`server.py`).
- Models (UVR, WhisperX) are downloaded automatically on first run.

### Database
- SQLite via rusqlite (bundled).
- Schema migrations in `app-core/src/library_db/migrations.rs`.
- Database path is configurable, defaulting to `~/.nightingale/`.

---

## Build & Run

### Prerequisites
- Rust (latest stable)
- Node.js + pnpm
- Tauri v2 system dependencies (WebView2 on Windows, etc.)

### Development
```bash
# Frontend dev server (Vite)
cd client && pnpm install && pnpm dev

# Tauri desktop app
cd client && pnpm tauri dev

# Rust workspace
cargo build  # builds all workspace members
```

### Format & Lint
```bash
# Rust
cargo fmt && cargo clippy

# Frontend
cd client && pnpm format && pnpm lint
```

---

## Important Notes for AI Agents

1. **Do NOT create new files unless necessary** — prefer editing existing files.
2. **Do NOT create documentation (README, .md) files** unless explicitly requested.
3. **Do NOT commit changes** unless explicitly asked.
4. **Follow the existing code style** — check nearby files for conventions before making changes.
5. **The frontend uses oxlint/oxfmt, NOT ESLint/Prettier** — do not add ESLint or Prettier config.
6. **Edition 2024 Rust** — be aware of edition-specific syntax and features.
7. **Tauri v2** — IPC uses `@tauri-apps/api` v2 conventions.
8. **Tailwind CSS v4** — uses CSS-first configuration (no `tailwind.config.js`).
9. **Python scripts** are in `app-core/analyzer/` — they are not standalone; they are spawned by the Rust backend.