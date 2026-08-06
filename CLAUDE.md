# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Obiter is a markdown-backed, AI-enabled notes app built as a Tauri 2 desktop app with a React 19 + TypeScript frontend. Notes are plain `.md` files in a plain folder — no app-owned container, no proprietary format. That constraint drives most of the design.

Shipped so far: settings with keychain-backed secrets, notebook reading and the folder tree, autosave writes, byte-stable markdown round-trip, a ProseKit editor, and a migration of the UI onto Base UI. `CONTEXT.md` is the domain glossary and fixes the vocabulary — notebook, folder, note, open note, refresh, connected/disconnected. Use those words; check it before naming anything new.

## Commands

Uses **pnpm** as the package manager and **Vite+** (`vp`, the `vite-plus` package) as the unified frontend toolchain — Vite, Vitest, Oxlint, and Oxfmt configured together through `vite.config.ts`. Run `vp` via `pnpm exec vp` (or the global `vp` binary if available).

- `pnpm tauri dev` — run the full desktop app (starts the dev server on port 1420, then launches the Tauri window)
- `pnpm dev` — frontend only in the browser (Tauri `invoke` calls will fail without the Rust backend)
- `pnpm exec vp check` — format check and lint (oxfmt + oxlint); `--fix` to auto-fix. It does **not** typecheck. For validation loops use `pnpm exec vp check && pnpm exec tsc --noEmit`, which is what the pre-commit hook and CI both do.
- `pnpm exec tsc --noEmit` — typecheck. Separate from `vp check` on purpose, so type errors can't slip through.
- `pnpm exec vp test` — Vitest; run a single file with `vp test path/to/file.test.tsx`, filter by name with `-t "name"`.
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

Frontend modules: `notebook/` (folder tree), `notes/` (the open note and its autosave), `editor/` (ProseKit and the markdown round-trip), `settings/` (settings and secrets), `app/` (wiring), `components/` (shared UI).

## Conventions

These are all enforced somewhere — CI, a hook, or a decision record. None of them are optional.

- **`CONTEXT.md`** — the domain glossary. Canonical words for the domain; the code already follows it. Note the caveat it flags: the settings schema still spells notebook as `vault` internally.
- **`adr/`** — decision records. Check here before revisiting an architectural choice. `0001` covers the Base UI substrate and carries the no-runtime-CDN rule (the app must not phone home); `0002` covers the open note as a store.
- **CI** (`.github/workflows/ci.yml`) — two jobs, `frontend` and `rust`, gating format, lint, typecheck, and tests on both sides for every PR and every push to main.
- **Pre-commit hook** (`lefthook.yml`) — `vp check`, `tsc --noEmit`, and `cargo check`, installed automatically by the `prepare` script. Tests run in CI, not here, so commits stay quick.
- **Conventional Commits** (`commitlint.config.js`) — enforced by the lefthook `commit-msg` hook.
- **Branch naming** — `type/slug`, matching the commit type: `feat/refresh-seam`, `docs/adr-0001-base-ui`.
- **Tracker labels** — labels mark issues, not PRs, and mark intent rather than execution: `enhancement` for feature work, `spec` for PRD-style issues written to the What to build / Acceptance criteria / Depends on shape.
