import { useEffect, useRef, useState } from "react";
import { Bold, Code, Italic, Link, List } from "lucide-react";
import { IconButton } from "../components/core/IconButton";
import { Kbd } from "../components/core/Kbd";
import { mount, type ActiveMarks, type NoteEditor } from "../editor/prosekit-editor";
import "./NoteView.css";

export interface NoteViewProps {
  /** directory shown in the breadcrumb, e.g. "~/Notes/" */
  dirLabel: string;
  /** filename shown in the breadcrumb, e.g. "on-keeping-notes.md" */
  fileName: string;
  /** the note's markdown as read from disk */
  markdown: string;
  /** called with the serialized markdown on ⌘S — write the file here */
  onSave?: (markdown: string) => void;
  railVisible?: boolean;
  focusMode?: boolean;
  measure?: "58ch" | "62ch" | "72ch";
}

/**
 * The core writing surface: a WYSIWYG editor over a markdown file. The
 * editing experience is rich, but the file on disk stays plain markdown —
 * conversion happens at the edges (see editor/markdown.ts).
 */
export function NoteView({
  dirLabel,
  fileName,
  markdown,
  onSave,
  railVisible = true,
  focusMode = false,
  measure = "62ch",
}: NoteViewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<NoteEditor | null>(null);
  const [active, setActive] = useState<ActiveMarks>({
    bold: false,
    italic: false,
    code: false,
  });
  const [words, setWords] = useState(0);
  const [savedLabel, setSavedLabel] = useState("saved");

  useEffect(() => {
    if (!editorRef.current) return;
    const pm = mount(editorRef.current, markdown, {
      onState: (s) => {
        setActive(s.active);
        setWords(s.words);
      },
    });
    pmRef.current = pm;
    return () => {
      pm.destroy();
      pmRef.current = null;
    };
  }, [markdown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const pm = pmRef.current;
        if (!pm) return;
        const md = pm.getMarkdown();
        const bytes = new TextEncoder().encode(md).length;
        setSavedLabel(`saved · ${bytes} B on disk`);
        onSave?.(md);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  return (
    <div className={`note-view${focusMode ? " note-view--focus" : ""}`}>
      <div className="note-view__toolbar">
        <span className="note-view__crumb-dir">{dirLabel}</span>
        <span className="note-view__crumb-file">{fileName}</span>
        <div className="note-view__divider" />
        <IconButton
          icon={Bold}
          aria-label="Bold"
          size="sm"
          active={active.bold}
          onClick={() => pmRef.current?.toggleBold()}
        />
        <IconButton
          icon={Italic}
          aria-label="Italic"
          size="sm"
          active={active.italic}
          onClick={() => pmRef.current?.toggleItalic()}
        />
        <IconButton
          icon={Code}
          aria-label="Inline code"
          size="sm"
          active={active.code}
          onClick={() => pmRef.current?.toggleCode()}
        />
        <IconButton
          icon={List}
          aria-label="Bullet list"
          size="sm"
          onClick={() => pmRef.current?.toggleList()}
        />
        <IconButton
          icon={Link}
          aria-label="Link"
          size="sm"
          onClick={() => pmRef.current?.toggleLink()}
        />
        <div className="note-view__toolbar-right">
          <span className="note-view__words">{words} words</span>
          <Kbd>⌘</Kbd>
          <Kbd>S</Kbd>
        </div>
      </div>

      <div className="note-view__scroll">
        <div className="note-view__page">
          {railVisible && (
            <aside className="note-view__rail">
              <span className="note-view__rail-mark">[…]</span>
              A real ProseKit editor. Type here — bold, lists, headings — and it round-trips to
              plain markdown. ⌘S serializes the file.
            </aside>
          )}
          <div
            ref={editorRef}
            className="note-view__editor obiter-pm"
            style={{ maxWidth: measure }}
          />
        </div>
      </div>

      <div className="note-view__footer">
        <span className="note-view__saved">{savedLabel}</span>
        <span>{words} words</span>
        <span className="note-view__disk">markdown · UTF-8 · LF</span>
      </div>
    </div>
  );
}
