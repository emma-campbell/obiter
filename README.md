# Obiter

A lightweight, local markdown notes app. Your notes are ordinary `.md` files in
an ordinary folder — openable with `cat`, editable in any other tool, and
readable long after this app is gone. That's the whole thesis.

Obiter is a Tauri 2 desktop app with a React 19 + TypeScript frontend and a Rust
backend.

## Where things are

- `src/` — the React frontend. `notebook/` reads the folder tree, `notes/` owns
  the open note and its autosave, `editor/` is the ProseKit editor and the
  markdown round-trip, `settings/` is settings plus keychain-backed secrets,
  `app/` wires it together, and `components/` holds the shared UI.
- `src-tauri/` — the Rust backend. Filesystem reads and writes, settings, and
  secrets live here; the frontend reaches them through `invoke`.
- `CONTEXT.md` — the domain glossary. If you're wondering whether to call
  something a notebook, a note, or an open note, that file decides. Read it
  before naming anything.
- `adr/` — decision records for the choices that would otherwise get relitigated.

## Running it

Needs [pnpm](https://pnpm.io) and the
[Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your
platform.

```sh
pnpm install
pnpm tauri dev
```

`pnpm dev` runs the frontend alone in a browser, which is faster for pure UI
work — but every `invoke` call fails without the Rust side, so anything that
touches a file needs the full app.

## Checks

```sh
pnpm exec vp check      # format + lint
pnpm exec tsc --noEmit  # typecheck — vp check does not do this
pnpm exec vp test       # Vitest
```

A pre-commit hook runs the first two plus `cargo check`; CI runs all of them on
both the TypeScript and Rust sides. Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/).

## Recommended editor setup

[VS Code](https://code.visualstudio.com/) with
[Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
and
[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
