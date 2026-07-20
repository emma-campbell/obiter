import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Toolbar } from "@base-ui/react/toolbar";
import { Bold, Code, Italic, Link, List } from "lucide-react";
import { IconButton } from "../components/core/IconButton";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "../components/core/Tooltip";
import { joinFrontmatter, splitFrontmatter } from "../editor/markdown";
import { mount, type ActiveMarks, type NoteEditor } from "../editor/prosekit-editor";
import { readNote, writeNote } from "../notebook/client";
import { useAutosave, type SaveStatus } from "./useAutosave";
import "./Editor.css";

export interface EditorProps {
  /** Notebook-relative path of the open note. Keyed by path, so switching
   *  notes remounts the editor — which flushes the outgoing note's save. */
  path: string;
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "saved",
  saving: "saving…",
  error: "couldn't save",
};

/**
 * One formatting control: a Base UI Toolbar item (roving tabindex) that is also
 * a tooltip trigger, wrapping our IconButton. The label serves as both the
 * accessible name and the visible tooltip.
 */
function FormatButton({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <TooltipRoot>
      <Toolbar.Button
        render={
          <TooltipTrigger
            render={
              <IconButton
                icon={icon}
                aria-label={label}
                size="sm"
                active={active}
                onClick={onClick}
              />
            }
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </TooltipRoot>
  );
}

/**
 * The note view: an editable ProseKit editor over the note's markdown.
 * Frontmatter is split off on load and re-attached on save so it survives
 * verbatim without passing through the editor. Edits autosave (see
 * useAutosave); there is no manual save mode.
 */
export function Editor({ path }: EditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<NoteEditor | null>(null);
  const frontmatterRef = useRef("");
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [words, setWords] = useState(0);
  const [active, setActive] = useState<ActiveMarks>({ bold: false, italic: false, code: false });

  // Apply a full note's markdown: split frontmatter off (kept aside), hand
  // the body to the editor. Used both on initial load and on an external
  // reload triggered from focus.
  const applyContent = (md: string) => {
    const { frontmatter, body: noteBody } = splitFrontmatter(md);
    frontmatterRef.current = frontmatter;
    setBody(noteBody);
  };
  const applyContentRef = useRef(applyContent);
  applyContentRef.current = applyContent;

  const autosave = useAutosave({
    read: () => joinFrontmatter(frontmatterRef.current, pmRef.current?.getMarkdown() ?? ""),
    write: (contents) => writeNote(path, contents),
    readDisk: () => readNote(path),
    applyReload: (md) => applyContentRef.current(md),
  });
  // Stable ref so the mount effect doesn't re-run when autosave identity
  // changes; the editor mounts once per loaded note.
  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;

  // Load the note whenever the open path changes.
  useEffect(() => {
    let cancelled = false;
    setBody(null);
    setError(false);
    readNote(path)
      .then((md) => {
        if (!cancelled) applyContentRef.current(md);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Mount the editable editor once the body is in hand. Cleanup flushes any
  // pending write for this note *before* tearing the editor down, so a
  // note-switch (which remounts) never drops edits.
  useEffect(() => {
    if (body === null || !mountRef.current) return;
    const pm = mount(
      mountRef.current,
      body,
      {
        onState: (s) => {
          setActive(s.active);
          setWords(s.words);
        },
        onChange: () => autosaveRef.current.schedule(),
      },
      { editable: true },
    );
    pmRef.current = pm;
    autosaveRef.current.markSaved(joinFrontmatter(frontmatterRef.current, pm.getMarkdown()));
    return () => {
      autosaveRef.current.flush();
      pm.destroy();
      pmRef.current = null;
    };
  }, [body]);

  // ⌘S forces an immediate save and never lets the browser's save dialog
  // appear. Autosave usually already handled it — this is the reflex.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        autosaveRef.current.flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      <Toolbar.Root className="editor__toolbar" aria-label="Formatting">
        <FormatButton
          icon={Bold}
          label="Bold"
          active={active.bold}
          onClick={() => pmRef.current?.toggleBold()}
        />
        <FormatButton
          icon={Italic}
          label="Italic"
          active={active.italic}
          onClick={() => pmRef.current?.toggleItalic()}
        />
        <FormatButton
          icon={Code}
          label="Inline code"
          active={active.code}
          onClick={() => pmRef.current?.toggleCode()}
        />
        <FormatButton icon={List} label="Bullet list" onClick={() => pmRef.current?.toggleList()} />
        <FormatButton icon={Link} label="Link" onClick={() => pmRef.current?.toggleLink()} />
        <div className="editor__toolbar-right">
          <span className="editor__words">{words} words</span>
        </div>
      </Toolbar.Root>

      <div className="editor__scroll">
        <div ref={mountRef} className="editor__mount obiter-pm" />
      </div>

      <div className="editor__footer">
        <span className="editor__saved" data-status={autosave.status}>
          {STATUS_LABEL[autosave.status]}
        </span>
        <span>{words} words</span>
        <span className="editor__disk">markdown · UTF-8 · LF</span>
      </div>
    </div>
  );
}
