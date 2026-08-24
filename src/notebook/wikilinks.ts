// Resolving a [[wikilink]] target against the notebook. The conversion
// layer keeps the target verbatim; this is where it becomes (or fails to
// become) a real note path.
//
// Rules, Obsidian-compatible and deliberately minimal:
//   - anything after # (a heading reference) is ignored for resolution
//   - a bare name matches any note whose filename stem equals it,
//     case-insensitively: [[Dumplings]] finds recipes/dumplings.md
//   - a target with / must also match the tail of the notebook-relative
//     path, so [[recipes/dumplings]] can't land on drafts/dumplings.md
//   - ties go to the shallowest, then lexicographically first, path — the
//     note nearest the notebook root wins
//   - no match is just null; creating the missing note is not this seam's
//     job (the app has no note creation yet)

import type { Entry } from "./notebook";

export type SearchNotes = (query: string) => Promise<Entry[]>;

/** The part of a wikilink target that names a note: pipe-less by
 *  construction, with any #heading suffix and surrounding space dropped. */
export function noteRef(target: string): string {
  const hash = target.indexOf("#");
  return (hash === -1 ? target : target.slice(0, hash)).trim();
}

const stem = (name: string) => name.replace(/\.md$/i, "");

/**
 * Find the note a wikilink target refers to, or null. Candidates come from
 * the backend filename search (a case-insensitive subsequence match, so a
 * superset of every exact-stem match).
 */
export async function resolveWikilink(target: string, search: SearchNotes): Promise<Entry | null> {
  const ref = noteRef(target);
  if (!ref) return null;
  const segments = ref.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const name = segments[segments.length - 1];

  const entries = await search(stem(name));
  const wantStem = stem(name).toLowerCase();
  const wantTail = segments.map((s) => s.toLowerCase());

  const matches = entries.filter((entry) => {
    if (entry.kind !== "file") return false;
    if (stem(entry.name).toLowerCase() !== wantStem) return false;
    if (wantTail.length === 1) return true;
    const parts = entry.path.toLowerCase().split("/");
    if (wantTail.length > parts.length) return false;
    const tail = parts.slice(parts.length - wantTail.length);
    return wantTail.every(
      (seg, i) => seg === (i === wantTail.length - 1 ? stem(tail[i]) : tail[i]),
    );
  });

  matches.sort((a, b) => {
    const depth = a.path.split("/").length - b.path.split("/").length;
    return depth !== 0 ? depth : a.path.localeCompare(b.path);
  });
  return matches[0] ?? null;
}
