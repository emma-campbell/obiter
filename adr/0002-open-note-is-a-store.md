# ADR 0002 — The open note is a store, not a hook

Status: accepted · 2026-07-29

## Context

The **open note** — the note loaded in the editor plus any edits not yet on
disk — had no module. Its state was spread across five refs in `Editor.tsx`
(`frontmatterRef`, `pmRef`, `applyContentRef`, `autosaveRef`, plus
`body`/`error` state) and a private `baseline` ref inside `useAutosave`,
whose interface was four callbacks (`read`, `write`, `readDisk`,
`applyReload`) that each closed over those refs.

That shape lost a note. `useAutosave` registered its `blur` listener from
first render, but `read` returned `""` until the mount effect ran and
`baseline` was still `null`, so blurring inside the `read_note` window wrote
the empty string over the file. Every autosave test opened with
`markSaved()`, which primed a baseline — which is precisely why the window
was never exercised. The logic had been extracted for testability, and the
bug lived in how it was called.

Two decisions about the replacement are load-bearing enough to record, since
both cut against the grain of the surrounding code and will otherwise be
re-litigated.

## Decision

### The open note is a framework-free store with a React adapter

`open-note.ts` is plain TypeScript — no React. `useOpenNote.ts` binds it via
`useSyncExternalStore`. Everywhere else in the app, state lives in a hook
(`useChooseFolder`) or a context provider (`SettingsProvider`); this is
deliberately different.

Why:

- **The state machine is not a React concern.** `useAutosave` carried five
  refs whose only purpose was "so the stable callbacks below always see the
  latest closures" — React tax on a debounce and a baseline. In a closure
  they are just variables, and the stale-closure class of bug cannot occur.
- **Tests stop paying React ceremony.** `open-note.test.ts` needs no
  `renderHook`, no `act`, no `waitFor`, and no jsdom — Vitest reports
  `environment 0ms`. The old tests wrapped every assertion in `act()` to
  exercise logic that had nothing to do with rendering.
- **The conflict UI may not live inside the editor.** #34's open questions
  ask whether the conflict banner is "editor vs toast", and the toast
  viewport is mounted in `RootLayout`, outside the editor's subtree. An
  external store can be subscribed to from anywhere; lifting it to a
  provider later needs no rewrite.

The state is a **nested** discriminated union — `body` and the save state
exist only in the `ready` variant — so a save before the read lands does not
typecheck. Making the data-loss state unrepresentable, rather than guarding
against it, is the justification for the refactor over keeping the guard.

The live document is the one thing the store does not own. ProseMirror holds
it as a node tree and `getMarkdown()` is a full remark round-trip, so pulling
on save beats pushing per keystroke; it arrives through `attach`.

### Disk access is an injected port, not a global IPC mock

The store takes a two-method `NoteIo` (`read`, `write`) with two adapters:
the Tauri notebook client in the app, an in-memory fake in tests. This sits
alongside `mockIPC` from `@tauri-apps/api/mocks`, which the rest of the
frontend tests use and which stubs one layer lower.

Why a second substitution mechanism is worth it here:

- `mockIPC` is ambient and string-keyed — command names as strings, hand-cast
  args, `clearMocks()` in `afterEach`. Having just made the store hermetic,
  importing the client directly would drag global mock installation back in.
- The store's hardest behaviours are about **disk changing underneath you**:
  reload-if-clean on focus, and all of #34. With a port that is
  `disk["n.md"] = "v2"`. Through `mockIPC` it is mutating a closure inside a
  command-name switch.

`Editor.test.tsx` still uses `mockIPC`: the component reaches the real client
through the adapter, so component-level wiring tests are unaffected. The port
is for the store's own tests.

## Consequences

- `useAutosave.ts` and `useAutosave.test.tsx` are deleted rather than kept as
  an internal seam. With baseline, debounce, status and reconcile owned by the
  open note, what remained of the hook was a `setTimeout`.
- **A store created in render must not be disposed from an effect cleanup.**
  `main.tsx` wraps the app in `StrictMode`, so effects mount, clean up and
  mount again, while `useMemo` keeps the same store across that remount. The
  first version disposed on cleanup, so the second `load()` ran against a
  disposed store and the editor sat in `loading` forever with no content and
  no error. React offers no signal separating a real unmount from StrictMode's
  remount, so `useOpenNote` flushes but never disposes; `dispose()` remains
  for owners outside React. **Component tests must render under `StrictMode`**
  — a suite that renders bare will stay green while the app is broken.
- Two seams are now available to tests for the same dependency. A reader has
  to know which layer a given test stubs at: the store's tests inject
  `NoteIo`, everything else stubs `mockIPC`.
- The window wiring (`blur` → flush, `focus` → reconcile) lives in the
  adapter, not the store. Consolidating it into a refresh module is a change
  of caller, not a change of module.
- `SaveState` includes `conflicted` as the room #34 needs. Nothing enters it
  yet; `save()` already refuses to write in it.
