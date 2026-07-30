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

## Open Note

The note currently loaded in the editor, together with any edits not yet
written to disk. Exactly one note is open at a time; opening another closes
the first.

An open note is **loading**, **unreadable** (the file could not be read), or
**ready**. A ready one is **clean** when it matches the file on disk and
**dirty** when it carries edits that don't. Saving is continuous and
automatic — there is no manual save mode, and no "unsaved document" the user
has to remember to commit.

## Refresh

Obiter's notes are ordinary files, so another tool — an editor, `git pull`,
a sync client — can change them while Obiter is open. A **refresh** is
Obiter noticing: it re-checks the notebook is still there, re-reads the
folders on show, and picks up an outside change to the open note. A clean
open note takes the newer version silently; a dirty one keeps your edits.

Refreshes happen on their own. You never ask for one.

## Connected / Disconnected

The notebook is **connected** when a folder is chosen and readable.
**Disconnected** means no folder is chosen (first run). A chosen folder that
has gone missing (renamed, unmounted, deleted) is a distinct third state —
connected-but-unreadable — never silently downgraded to disconnected, so the
user's choice is never forgotten.
