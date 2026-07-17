import { useEffect, useRef, useState } from "react";
import { mount, type NoteEditor } from "../editor/prosekit-editor";
import { readNote } from "../notebook/client";
import "./Editor.css";

export interface EditorProps {
  /** Notebook-relative path of the open note; the editor reloads on change. */
  path: string;
}

/**
 * The note view: a real ProseKit editor rendering the note's markdown. This
 * slice is read-only — the file is displayed faithfully but editing is
 * disabled at the ProseMirror level, and there is no save. The write slice
 * flips `editable` and restores the formatting toolbar + ⌘S.
 */
export function Editor({ path }: EditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<NoteEditor | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [words, setWords] = useState(0);

  // Load the note's contents whenever the open path changes.
  useEffect(() => {
    let cancelled = false;
    setBody(null);
    setError(false);
    readNote(path)
      .then((md) => {
        if (!cancelled) setBody(md);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Mount a read-only editor once the contents are in hand.
  useEffect(() => {
    if (body === null || !mountRef.current) return;
    const pm = mount(
      mountRef.current,
      body,
      { onState: (s) => setWords(s.words) },
      { editable: false },
    );
    pmRef.current = pm;
    return () => {
      pm.destroy();
      pmRef.current = null;
    };
  }, [body]);

  if (error) {
    return (
      <div className="editor">
        <div className="editor__scroll">
          <div className="editor__mount" style={{ color: "var(--slate)", padding: "40px 0" }}>
            Couldn't open this note.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor">
      <div className="editor__toolbar">
        <span className="editor__readonly" style={{ fontSize: 13, color: "var(--slate)" }}>
          Read-only preview — saving lands next
        </span>
        <div className="editor__toolbar-right">
          <span className="editor__words">{words} words</span>
        </div>
      </div>

      <div className="editor__scroll">
        <div ref={mountRef} className="editor__mount obiter-pm" />
      </div>

      <div className="editor__footer">
        <span className="editor__saved">read-only</span>
        <span>{words} words</span>
        <span className="editor__disk">markdown · UTF-8 · LF</span>
      </div>
    </div>
  );
}
