# Obiter — Domain Glossary

The shared language for Obiter, a markdown-backed notes app. This file is a
glossary only — no implementation details, no decisions. Terms here are the
canonical words; use them in code, copy, and conversation.

## Notebook

The single root folder the user connects — the one Obiter reads notes from
and (later) writes them to. There is exactly one connected notebook at a
time; its location is a user setting. Deliberately **not** a special
container: a notebook is just a folder of markdown on disk, openable with
`cat`, readable by any other tool. The name is a humble paper metaphor, not
a proprietary format.

Avoid "vault" — it implies a special, app-owned container, which is the
opposite of Obiter's plain-files thesis. (Historical note: the settings
schema still spells this `vault` internally; see the notebook-reading work
for whether/when that is renamed.)

## Folder

Any directory **inside** the notebook. Folders nest; the note tree mirrors
the on-disk folder structure exactly — there are no virtual collections,
saved searches, or tag-folders. What you see is what is on disk.

## Note

A single markdown file inside the notebook. The unit the user reads and
edits. "Note" is the app's word throughout (`NoteFile`, `src/notes/`).

## Connected / Disconnected

The notebook is **connected** when a folder is chosen and readable.
**Disconnected** means no folder is chosen (first run). A chosen folder that
has gone missing (renamed, unmounted, deleted) is a distinct third state —
connected-but-unreadable — never silently downgraded to disconnected, so the
user's choice is never forgotten.
