import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CornerDownLeft, Search } from "lucide-react";
import { Icon } from "../core/Icon";
import { Kbd } from "../core/Kbd";

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
}

/**
 * A full command palette: runnable actions and note-jump in one list, filtered
 * by a single query, driven by the keyboard. Plain and sectioned — no scores
 * shown, no urgency. Pair it with the FileTree: tree for structure, this for speed.
 */
export function CommandPalette({
  open,
  items = [],
  onClose,
  placeholder = "Search notes, or run a command",
}: CommandPaletteProps) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (it) =>
        !s ||
        it.label.toLowerCase().includes(s) ||
        (it.hint ?? "").toLowerCase().includes(s) ||
        (it.keywords ?? "").toLowerCase().includes(s),
    );
  }, [q, items]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;
    const run = (it?: PaletteItem) => {
      if (it) {
        it.run?.();
        onClose?.();
      }
    };
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        run(filtered[active]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, filtered, active, onClose]);

  if (!open) return null;

  const runItem = (it: PaletteItem) => {
    it.run?.();
    onClose?.();
  };

  // Section order = order of first appearance.
  const sections: string[] = [];
  for (const it of filtered) {
    const s = it.section ?? "Commands";
    if (!sections.includes(s)) sections.push(s);
  }
  let flat = -1;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(28,27,24,0.18)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 96,
        zIndex: 30,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 540,
          maxWidth: "90%",
          background: "var(--paper)",
          border: "1px solid var(--ash)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: "1px solid var(--chalk)",
          }}
        >
          <Icon icon={Search} size={16} style={{ color: "var(--slate)" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--ink)",
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div style={{ maxHeight: 320, overflow: "auto", padding: 6 }}>
          {filtered.length === 0 && (
            <div
              style={{
                padding: 14,
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                color: "var(--slate)",
              }}
            >
              Nothing matches. Enter creates {q || "a note"}.md
            </div>
          )}
          {sections.map((sec) => (
            <div key={sec}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  color: "var(--slate)",
                  padding: "8px 10px 4px",
                }}
              >
                {sec}
              </div>
              {filtered
                .filter((it) => (it.section ?? "Commands") === sec)
                .map((it) => {
                  flat += 1;
                  const on = flat === active;
                  const idx = flat;
                  return (
                    <button
                      type="button"
                      key={it.id}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => runItem(it)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        background: on ? "var(--bg-subtle)" : "transparent",
                        borderRadius: "var(--radius)",
                        padding: "9px 10px",
                        cursor: "pointer",
                        color: "var(--ink)",
                      }}
                    >
                      <Icon
                        icon={it.icon ?? CornerDownLeft}
                        size={15}
                        style={{ color: on ? "var(--pencil-600)" : "var(--slate)" }}
                      />
                      <span
                        style={{
                          fontFamily: it.mono ? "var(--font-mono)" : "var(--font-sans)",
                          fontSize: it.mono ? 12.5 : 14,
                        }}
                      >
                        {it.label}
                      </span>
                      {it.hint && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--slate)",
                          }}
                        >
                          {it.hint}
                        </span>
                      )}
                      {it.shortcut && (
                        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                          {it.shortcut.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
