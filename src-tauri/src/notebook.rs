//! Notebook: reading the folder of notes the user connected.
//!
//! No Tauri dependency — everything is a pure function of "a real directory
//! on disk + visibility settings → what the frontend may see." The command
//! layer in `lib.rs` builds a `Notebook` from the current settings and
//! delegates.
//!
//! Three concerns live behind this interface: notebook-relative ↔ absolute
//! path resolution, root **confinement** (nothing outside the notebook is
//! ever reachable — the security boundary AI features will lean on), and
//! visibility filtering (configured extensions, hidden files/dirs). Paths
//! spoken across the boundary are always notebook-relative with `/`
//! separators; `""` is the root.

use std::io;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

/// A single listing entry — one file or one folder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    /// Notebook-relative path, `/`-separated (e.g. `recipes/dumplings.md`).
    pub path: String,
    pub kind: EntryKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Folder,
}

/// Everything that can go wrong reading a notebook, serialized to the
/// frontend as a tagged union so the UI can tell "folder is gone" (a
/// recoverable, user-facing state) from an incidental IO failure.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NotebookError {
    /// No notebook is connected (`notebook.path` is null). Surfaced by the
    /// command layer, never by the module itself.
    NotConnected,
    /// The connected folder is gone or unreadable (renamed, unmounted,
    /// deleted). Distinct from `Io` so the shell can offer retry/re-pick
    /// without forgetting the user's choice.
    Missing,
    /// A requested path resolved outside the notebook root — rejected.
    OutsideRoot,
    /// Any other filesystem failure.
    Io { message: String },
}

impl From<io::Error> for NotebookError {
    fn from(e: io::Error) -> Self {
        NotebookError::Io {
            message: e.to_string(),
        }
    }
}

pub struct Notebook {
    root: PathBuf,
    shown_extensions: Vec<String>,
    show_hidden: bool,
}

impl Notebook {
    pub fn new(root: impl Into<PathBuf>, shown_extensions: Vec<String>, show_hidden: bool) -> Self {
        Self {
            root: root.into(),
            shown_extensions: shown_extensions
                .into_iter()
                .map(|e| e.to_ascii_lowercase())
                .collect(),
            show_hidden,
        }
    }

    /// List one folder's immediate children — folders first, then files,
    /// each sorted case-insensitively, already filtered for visibility.
    /// Lazy by design: the caller lists deeper folders as they expand.
    pub fn list_dir(&self, rel: &str) -> Result<Vec<Entry>, NotebookError> {
        let root = self.canon_root()?;
        let dir = self.resolve(&root, rel)?;

        let mut entries = Vec::new();
        for dirent in std::fs::read_dir(&dir)? {
            let dirent = dirent?;
            let name = dirent.file_name().to_string_lossy().into_owned();
            let is_hidden = name.starts_with('.');
            if is_hidden && !self.show_hidden {
                // Skipping a hidden directory here prunes its whole subtree:
                // what is never listed can never be expanded.
                continue;
            }

            let file_type = dirent.file_type()?;
            let child_rel = if rel_is_root(rel) {
                name.clone()
            } else {
                format!("{}/{}", rel.trim_matches('/'), name)
            };

            if file_type.is_dir() {
                entries.push(Entry {
                    name,
                    path: child_rel,
                    kind: EntryKind::Folder,
                });
            } else if self.extension_shown(&name) {
                entries.push(Entry {
                    name,
                    path: child_rel,
                    kind: EntryKind::File,
                });
            }
        }

        entries.sort_by(|a, b| {
            folder_first(a.kind)
                .cmp(&folder_first(b.kind))
                .then_with(|| a.name.to_ascii_lowercase().cmp(&b.name.to_ascii_lowercase()))
        });
        Ok(entries)
    }

    /// Find notes whose filename matches `query` (case-insensitive
    /// subsequence), walking the whole notebook. Same visibility filtering
    /// as `list_dir`; symlinks are not followed, so the walk can't escape
    /// the root. Results are bounded — this is a live walk, and a real index
    /// (SQLite/FTS5) will replace the implementation behind this method.
    pub fn search(&self, query: &str) -> Result<Vec<Entry>, NotebookError> {
        let root = self.canon_root()?;
        let needle = query.to_ascii_lowercase();
        let mut hits = Vec::new();
        self.walk(&root, "", &needle, &mut hits);
        hits.sort_by(|a, b| a.path.to_ascii_lowercase().cmp(&b.path.to_ascii_lowercase()));
        hits.truncate(MAX_SEARCH_RESULTS);
        Ok(hits)
    }

    fn walk(&self, dir: &Path, rel: &str, needle: &str, out: &mut Vec<Entry>) {
        let Ok(read) = std::fs::read_dir(dir) else {
            return;
        };
        for dirent in read.flatten() {
            let Ok(file_type) = dirent.file_type() else {
                continue;
            };
            // Never follow a symlink — a symlinked directory could point
            // outside the notebook, and the confinement must hold here too.
            if file_type.is_symlink() {
                continue;
            }
            let name = dirent.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') && !self.show_hidden {
                continue;
            }
            let child_rel = if rel.is_empty() {
                name.clone()
            } else {
                format!("{rel}/{name}")
            };
            if file_type.is_dir() {
                self.walk(&dirent.path(), &child_rel, needle, out);
            } else if self.extension_shown(&name)
                && is_subsequence(needle, &name.to_ascii_lowercase())
            {
                out.push(Entry {
                    name,
                    path: child_rel,
                    kind: EntryKind::File,
                });
            }
        }
    }

    /// Read a note's contents. Root-confined like `list_dir`, and — because
    /// resolution is independent of the tree — it resolves a note whose
    /// parent folder was never expanded, so search/jump can open anything.
    pub fn read_note(&self, rel: &str) -> Result<String, NotebookError> {
        let root = self.canon_root()?;
        let file = self.resolve(&root, rel)?;
        Ok(std::fs::read_to_string(file)?)
    }

    /// Canonicalized notebook root. A root that can't be canonicalized (or
    /// isn't a directory) is `Missing`, never a bare IO error.
    fn canon_root(&self) -> Result<PathBuf, NotebookError> {
        let canonical = self.root.canonicalize().map_err(|_| NotebookError::Missing)?;
        if !canonical.is_dir() {
            return Err(NotebookError::Missing);
        }
        Ok(canonical)
    }

    /// Resolve a notebook-relative path to an absolute one, confined to the
    /// root. Rejects `..`, absolute inputs, and symlink escapes: the target
    /// is canonicalized (resolving every symlink) and must still sit under
    /// the canonical root.
    fn resolve(&self, canon_root: &Path, rel: &str) -> Result<PathBuf, NotebookError> {
        let rel_path = Path::new(rel);
        let escapes = rel_path.components().any(|c| {
            matches!(
                c,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        });
        if escapes {
            return Err(NotebookError::OutsideRoot);
        }

        let target = canon_root.join(rel_path).canonicalize()?;
        if !target.starts_with(canon_root) {
            return Err(NotebookError::OutsideRoot);
        }
        Ok(target)
    }

    fn extension_shown(&self, name: &str) -> bool {
        match name.rsplit_once('.') {
            Some((_, ext)) => self.shown_extensions.contains(&ext.to_ascii_lowercase()),
            None => false,
        }
    }
}

/// Cap on search results — a live walk, so bound the output. Indexing later
/// makes both the walk and this cap moot.
const MAX_SEARCH_RESULTS: usize = 50;

/// Whether `needle`'s chars appear in `haystack` in order (not necessarily
/// contiguous). Both are expected pre-lowercased.
fn is_subsequence(needle: &str, haystack: &str) -> bool {
    let mut chars = haystack.chars();
    needle.chars().all(|c| chars.any(|h| h == c))
}

fn rel_is_root(rel: &str) -> bool {
    rel.trim_matches('/').is_empty()
}

fn folder_first(kind: EntryKind) -> u8 {
    match kind {
        EntryKind::Folder => 0,
        EntryKind::File => 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn notebook(root: &Path) -> Notebook {
        Notebook::new(root, vec!["md".into()], false)
    }

    fn names(entries: &[Entry]) -> Vec<&str> {
        entries.iter().map(|e| e.name.as_str()).collect()
    }

    #[test]
    fn lists_root_children_folders_first_then_sorted() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("recipes")).unwrap();
        fs::create_dir(root.join("obiter")).unwrap();
        fs::write(root.join("reading.md"), "").unwrap();
        fs::write(root.join("Aardvark.md"), "").unwrap();

        let entries = notebook(root).list_dir("").unwrap();

        // Folders (sorted) before files (sorted), case-insensitively.
        assert_eq!(names(&entries), ["obiter", "recipes", "Aardvark.md", "reading.md"]);
        assert_eq!(entries[0].kind, EntryKind::Folder);
        assert_eq!(entries[2].kind, EntryKind::File);
    }

    #[test]
    fn lists_a_subfolder_with_relative_child_paths() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("recipes")).unwrap();
        fs::write(root.join("recipes/dumplings.md"), "").unwrap();

        let entries = notebook(root).list_dir("recipes").unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "recipes/dumplings.md");
    }

    #[test]
    fn filters_by_shown_extensions() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("keep.md"), "").unwrap();
        fs::write(root.join("UPPER.MD"), "").unwrap(); // extension match is case-insensitive
        fs::write(root.join("skip.txt"), "").unwrap();
        fs::write(root.join("README"), "").unwrap(); // no extension

        let entries = notebook(root).list_dir("").unwrap();

        assert_eq!(names(&entries), ["keep.md", "UPPER.MD"]);
    }

    #[test]
    fn excludes_hidden_files_and_prunes_hidden_dirs_by_default() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("visible.md"), "").unwrap();
        fs::write(root.join(".secret.md"), "").unwrap();
        fs::create_dir(root.join(".git")).unwrap();
        fs::write(root.join(".git/config"), "").unwrap();

        let entries = notebook(root).list_dir("").unwrap();

        assert_eq!(names(&entries), ["visible.md"]);
    }

    #[test]
    fn show_hidden_reveals_dotfiles_and_dot_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("visible.md"), "").unwrap();
        fs::write(root.join(".secret.md"), "").unwrap();
        fs::create_dir(root.join(".obsidian")).unwrap();

        let nb = Notebook::new(root, vec!["md".into()], true);
        let entries = nb.list_dir("").unwrap();

        assert_eq!(names(&entries), [".obsidian", ".secret.md", "visible.md"]);
    }

    #[test]
    fn empty_notebook_lists_nothing() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(notebook(dir.path()).list_dir("").unwrap(), []);
    }

    #[test]
    fn parent_traversal_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("notes");
        fs::create_dir(&root).unwrap();
        fs::write(root.join("note.md"), "").unwrap();
        // A sibling secret outside the notebook.
        fs::write(dir.path().join("secret.md"), "").unwrap();

        let err = notebook(&root).list_dir("..").unwrap_err();
        assert!(matches!(err, NotebookError::OutsideRoot));
    }

    #[test]
    fn absolute_paths_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let err = notebook(dir.path()).list_dir("/etc").unwrap_err();
        assert!(matches!(err, NotebookError::OutsideRoot));
    }

    #[cfg(unix)]
    #[test]
    fn symlink_escape_is_rejected() {
        use std::os::unix::fs::symlink;
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("notes");
        fs::create_dir(&root).unwrap();
        let outside = dir.path().join("outside");
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("leak.md"), "").unwrap();
        // A symlink inside the notebook pointing at the outside folder.
        symlink(&outside, root.join("escape")).unwrap();

        // Listing through the symlink resolves outside the root → rejected.
        let err = notebook(&root).list_dir("escape").unwrap_err();
        assert!(matches!(err, NotebookError::OutsideRoot));
    }

    #[test]
    fn reads_a_note_by_relative_path() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("recipes")).unwrap();
        fs::write(root.join("recipes/dumplings.md"), "# Dumplings\n\nRest the dough.").unwrap();

        let body = notebook(root).read_note("recipes/dumplings.md").unwrap();
        assert_eq!(body, "# Dumplings\n\nRest the dough.");
    }

    #[test]
    fn reads_a_note_whose_folder_was_never_listed() {
        // No list_dir call precedes this — resolution is independent of the
        // tree, so a palette jump can open a note directly.
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("deep/nested")).unwrap();
        fs::write(root.join("deep/nested/note.md"), "buried").unwrap();

        let body = notebook(root).read_note("deep/nested/note.md").unwrap();
        assert_eq!(body, "buried");
    }

    #[test]
    fn read_note_rejects_paths_outside_the_root() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("notes");
        fs::create_dir(&root).unwrap();
        fs::write(dir.path().join("secret.md"), "top secret").unwrap();

        let err = notebook(&root).read_note("../secret.md").unwrap_err();
        assert!(matches!(err, NotebookError::OutsideRoot));
    }

    #[test]
    fn search_matches_filenames_by_subsequence_across_subfolders() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("recipes")).unwrap();
        fs::write(root.join("recipes/dumplings.md"), "").unwrap();
        fs::write(root.join("reading.md"), "").unwrap();
        fs::write(root.join("notes.md"), "").unwrap();

        // "dmp" is a subsequence of "dumplings", not a substring.
        let hits = notebook(root).search("dmp").unwrap();
        assert_eq!(names(&hits), ["dumplings.md"]);
        assert_eq!(hits[0].path, "recipes/dumplings.md");
    }

    #[test]
    fn search_is_case_insensitive() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("Reading.md"), "").unwrap();

        assert_eq!(names(&notebook(root).search("READING").unwrap()), ["Reading.md"]);
    }

    #[test]
    fn search_honors_visibility_rules() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("todo.md"), "").unwrap();
        fs::write(root.join("todo.txt"), "").unwrap(); // wrong extension
        fs::write(root.join(".todo.md"), "").unwrap(); // hidden
        fs::create_dir(root.join(".git")).unwrap();
        fs::write(root.join(".git/todo.md"), "").unwrap(); // in a hidden dir

        let hits = notebook(root).search("todo").unwrap();
        assert_eq!(names(&hits), ["todo.md"]);
    }

    #[test]
    fn search_does_not_follow_symlinked_dirs_out_of_the_notebook() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let dir = tempfile::tempdir().unwrap();
            let root = dir.path().join("notes");
            fs::create_dir(&root).unwrap();
            fs::write(root.join("inside.md"), "").unwrap();
            let outside = dir.path().join("outside");
            fs::create_dir(&outside).unwrap();
            fs::write(outside.join("secret.md"), "").unwrap();
            symlink(&outside, root.join("link")).unwrap();

            // The outside note is never surfaced through the symlink.
            let hits = notebook(&root).search("md").unwrap_or_default();
            let paths: Vec<&str> = hits.iter().map(|e| e.path.as_str()).collect();
            assert_eq!(paths, ["inside.md"]);
        }
    }

    #[test]
    fn search_bounds_its_results() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        for i in 0..80 {
            fs::write(root.join(format!("note-{i:03}.md")), "").unwrap();
        }
        assert_eq!(notebook(root).search("note").unwrap().len(), MAX_SEARCH_RESULTS);
    }

    #[test]
    fn search_on_an_empty_notebook_finds_nothing() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(notebook(dir.path()).search("anything").unwrap(), []);
    }

    #[test]
    fn missing_root_is_distinct_from_io() {
        let dir = tempfile::tempdir().unwrap();
        let gone = dir.path().join("never-existed");
        let err = notebook(&gone).list_dir("").unwrap_err();
        assert!(matches!(err, NotebookError::Missing));
    }

    #[test]
    fn a_file_as_root_is_missing_not_a_listing() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("not-a-folder.md");
        fs::write(&file, "").unwrap();
        let err = notebook(&file).list_dir("").unwrap_err();
        assert!(matches!(err, NotebookError::Missing));
    }
}
