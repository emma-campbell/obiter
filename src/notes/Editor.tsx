import { useEffect, useRef, useState } from "react";
import { Bold, Code, Italic, Link, List } from "lucide-react";
import { IconButton } from "../components/core/IconButton";
import { Kbd } from "../components/core/Kbd";
import { mount, type ActiveMarks, type NoteEditor } from "../editor/prosekit-editor";
import type { NoteFile } from "./notes-data";
import "./Editor.css";

export interface EditorProps {
  /** the open note — the editor re-mounts when `file.path` changes */
  file: NoteFile;
  /** called with the serialized markdown on ⌘S — write the file here */
  onSave?: (markdown: string) => void;
}

/**
 * The note view: a real ProseKit editor with a formatting toolbar and inline
 * prose editing. The editing experience is rich, but the file on disk stays
 * plain markdown — conversion happens at the edges (see editor/markdown.ts).
 */
export function Editor({ file, onSave }: EditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<NoteEditor | null>(null);
  const [active, setActive] = useState<ActiveMarks>({
    bold: false,
    italic: false,
    code: false,
  });
  const [words, setWords] = useState(0);
  const [savedLabel, setSavedLabel] = useState("saved");

  useEffect(() => {
    if (!mountRef.current) return;
    setSavedLabel("saved");
    const pm = mount(mountRef.current, file.body, {
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
    // body is fixed per path in the sample data; re-mount tracks the open file
  }, [file.path, file.body]);

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
    <div className="editor">
      <div className="editor__toolbar">
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
        <div className="editor__toolbar-right">
          <span className="editor__words">{words} words</span>
          <Kbd>⌘</Kbd>
          <Kbd>S</Kbd>
        </div>
      </div>

      <div className="editor__scroll">
        <div ref={mountRef} className="editor__mount obiter-pm" />
      </div>

      <div className="editor__footer">
        <span className="editor__saved">{savedLabel}</span>
        <span>{words} words</span>
        <span className="editor__disk">markdown · UTF-8 · LF</span>
      </div>
    </div>
  );
}
