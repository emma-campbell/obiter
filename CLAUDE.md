# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Obiter is a markdown-backed, AI-enabled notes app built as a Tauri 2 desktop app with a React 19 + TypeScript frontend. It is currently a fresh scaffold — the code is still the Tauri starter template (a `greet` command demo).

## Commands

Uses **pnpm** as the package manager and **Vite+** (`vp`, the `vite-plus` package) as the unified frontend toolchain — Vite, Vitest, Oxlint, and Oxfmt configured together through `vite.config.ts`. Run `vp` via `pnpm exec vp` (or the global `vp` binary if available).

- `pnpm tauri dev` — run the full desktop app (starts the dev server on port 1420, then launches the Tauri window)
- `pnpm dev` — frontend only in the browser (Tauri `invoke` calls will fail without the Rust backend)
- `pnpm exec vp check` — format check, lint, and type check together; `--fix` to auto-fix. Prefer this for validation loops.
- `pnpm exec vp test` — Vitest; run a single file with `vp test path/to/file.test.tsx`, filter by name with `-t "name"`. Currently exits 1 because no test files exist yet.
- `pnpm build` — typecheck (`tsc`) and build the frontend
- `pnpm tauri build` — build the distributable desktop app
- `cargo build` / `cargo check` from `src-tauri/` — Rust backend only

Vite+ notes: `vite` resolves to `@voidzero-dev/vite-plus-core` via the pnpm catalog in `pnpm-workspace.yaml` — don't add a plain `vite` dependency. `vp install` enforces a supply-chain minimum-release-age policy on new packages; a just-published version can fail verification (plain `pnpm install` after removing the stale lockfile resolves to a compliant older version).

## Architecture

Standard Tauri 2 two-process split:

- `src/` — React frontend (Vite). Calls into Rust via `invoke("command_name", { args })` from `@tauri-apps/api/core`.
- `src-tauri/` — Rust backend. Commands are `#[tauri::command]` functions in `src-tauri/src/lib.rs`, registered in the `tauri::generate_handler![]` macro inside `run()`. `main.rs` is just a thin entry point that calls `obiter_lib::run()`.
- `src-tauri/tauri.conf.json` — app config (window, bundle, dev server wiring). The dev server port (1420) is fixed and strict; Vite is configured to ignore `src-tauri/` in its file watcher.
- `src-tauri/capabilities/default.json` — Tauri permission grants for plugins/APIs the frontend may call.

Adding a new backend capability means: write the `#[tauri::command]` fn in `lib.rs`, add it to `generate_handler![]`, and call it with `invoke` from the frontend. Plugins (like the existing `tauri-plugin-opener`) need both a Rust-side `.plugin(...)` registration and a capability entry.
