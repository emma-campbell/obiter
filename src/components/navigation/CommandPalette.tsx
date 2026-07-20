import { useEffect, useMemo, useState } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import type { LucideIcon } from "lucide-react";
import { CornerDownLeft, FileText, Search } from "lucide-react";
import type { Entry } from "../../notebook/notebook";
import { Icon } from "../core/Icon";
import { Kbd } from "../core/Kbd";
import "./CommandPalette.css";

export interface PaletteItem {
  id: string;
  label: string;
  section?: string;
  icon?: LucideIcon;
  /** render the label in mono (note paths, machine text) */
  mono?: boolean;
  hint?: string;
  keywords?: string;
  shortcut?: string[];
  run?: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  items?: PaletteItem[];
  onClose?: () => void;
  placeholder?: string;
  /** Filename search over the notebook; results appear as a Notes section. */
  searchNotes?: (query: string) => Promise<Entry[]>;
  /** Open a note by its notebook-relative path. */
  onOpenNote?: (path: string) => void;
}

/** Parent folder of a notebook-relative path, for the result hint. */
function dirOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "notebook root" : path.slice(0, slash);
}

/**
 * A full command palette: runnable actions and note-jump in one list, filtered
 * by a single query. Runs on Base UI's Autocomplete (ADR 0001) in `none` mode —
 * Base UI owns the combobox/listbox roles, arrow-key navigation, active-
 * descendant highlight, and Enter/Escape; the filtering stays ours (commands
 * matched client-side, notes fetched from the backend), so we feed it the items
 * to show. Plain and sectioned — no scores, no urgency.
 */
export function CommandPalette({
  open,
  items = [],
  onClose,
  placeholder = "Search notes, or run a command",
  searchNotes,
  onOpenNote,
}: CommandPaletteProps) {
  const [q, setQ] = useState("");
  const [noteHits, setNoteHits] = useState<Entry[]>([]);

  // Note search runs against the backend (debounced), not the static items —
  // the backend already filtered, so its results are shown as-is.
  useEffect(() => {
    if (!open || !searchNotes) return;
    const s = q.trim();
    if (!s) {
      setNoteHits([]);
      return;
    }
    const t = setTimeout(() => {
      searchNotes(s)
        .then(setNoteHits)
        .catch(() => setNoteHits([]));
    }, 120);
    return () => clearTimeout(t);
  }, [q, open, searchNotes]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const commands = items.filter(
      (it) =>
        !s ||
        it.label.toLowerCase().includes(s) ||
        (it.hint ?? "").toLowerCase().includes(s) ||
        (it.keywords ?? "").toLowerCase().includes(s),
    );
    const notes: PaletteItem[] = noteHits.map((hit) => ({
      id: `note:${hit.path}`,
      label: hit.name,
      section: "Notes",
      icon: FileText,
      mono: true,
      hint: dirOf(hit.path),
      run: () => onOpenNote?.(hit.path),
    }));
    return [...commands, ...notes];
  }, [q, items, noteHits, onOpenNote]);

  if (!open) return null;

  const runItem = (it: PaletteItem) => {
    it.run?.();
    onClose?.();
  };

  // Section order = order of first appearance.
  const sections: string[] = [];
  for (const it of filtered) {
    const sec = it.section ?? "Commands";
    if (!sections.includes(sec)) sections.push(sec);
  }

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <Autocomplete.Root
          items={filtered.map((it) => it.id)}
          mode="none"
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) onClose?.();
          }}
          value={q}
          onValueChange={(value) => setQ(value)}
        >
          <div className="palette__header">
            <Icon icon={Search} size={16} className="palette__search-icon" />
            <Autocomplete.Input autoFocus placeholder={placeholder} className="palette__input" />
            <Kbd>Esc</Kbd>
          </div>
          <Autocomplete.List className="palette__list">
            {filtered.length === 0 && (
              <div className="palette__empty">
                Nothing matches. Enter creates {q || "a note"}.md
              </div>
            )}
            {sections.map((sec) => (
              <div key={sec}>
                <div className="palette__section">{sec}</div>
                {filtered
                  .filter((it) => (it.section ?? "Commands") === sec)
                  .map((it) => (
                    <Autocomplete.Item
                      key={it.id}
                      value={it.id}
                      className="palette__item"
                      onClick={() => runItem(it)}
                    >
                      <Icon
                        icon={it.icon ?? CornerDownLeft}
                        size={15}
                        className="palette__item-icon"
                      />
                      <span
                        className={
                          it.mono ? "palette__label palette__label--mono" : "palette__label"
                        }
                      >
                        {it.label}
                      </span>
                      {it.hint && <span className="palette__hint">{it.hint}</span>}
                      {it.shortcut && (
                        <span className="palette__shortcut">
                          {it.shortcut.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      )}
                    </Autocomplete.Item>
                  ))}
              </div>
            ))}
          </Autocomplete.List>
        </Autocomplete.Root>
      </div>
    </div>
  );
}
