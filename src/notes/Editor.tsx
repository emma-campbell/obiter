import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Toolbar } from "@base-ui/react/toolbar";
import { Bold, Code, Italic, Link, List } from "lucide-react";
import { IconButton } from "../components/core/IconButton";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "../components/core/Tooltip";
import { mount, type ActiveMarks, type NoteEditor } from "../editor/prosekit-editor";
import type { SaveState } from "./open-note";
import { useOpenNote } from "./useOpenNote";
import "./Editor.css";

export interface EditorProps {
  /** Notebook-relative path of the open note. Keyed by path, so switching
   *  notes remounts the editor — which flushes the outgoing note's save. */
  path: string;
  /** A [[wikilink]] was clicked; the target is as written in the note.
   *  Following it (resolution, navigation) is the shell's job — the editor
   *  stays router-free. */
  onWikilink?: (target: string) => void;
}

const STATUS_LABEL: Record<SaveState, string> = {
  clean: "saved",
  saving: "saving…",
  failed: "couldn't save",
  // Unreachable until #34 lands the simultaneous-edit UX, which replaces
  // this with a real affordance rather than a status word.
  conflicted: "conflict",
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
 * The note view: an editable ProseKit editor over the open note's markdown.
 * The note itself — loading, frontmatter, autosave, reload-from-disk — lives
 * in open-note.ts; this renders it and forwards edits. There is no manual
 * save mode.
 */
export function Editor({ path, onWikilink }: EditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<NoteEditor | null>(null);
  const [words, setWords] = useState(0);
  const [active, setActive] = useState<ActiveMarks>({ bold: false, italic: false, code: false });
  const { state, note } = useOpenNote(path);

  // The markdown to seed the editor with: set once the read lands, and again
  // if the note is reloaded after changing on disk.
  const body = state.status === "ready" ? state.body : null;

  // Held in a ref so the mount effect doesn't remount the editor whenever
  // the parent passes a fresh callback identity.
  const onWikilinkRef = useRef(onWikilink);
  onWikilinkRef.current = onWikilink;

  // Mount the editable editor once the body is in hand, and hand the note its
  // live document. Cleanup detaches before tearing the editor down, so no
  // save can ever try to serialize a destroyed editor.
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
        onChange: () => note.edit(),
        onWikilink: (target) => onWikilinkRef.current?.(target),
      },
      { editable: true },
    );
    pmRef.current = pm;
    note.attach(() => pm.getMarkdown());
    return () => {
      void note.flush();
      note.detach();
      pm.destroy();
      pmRef.current = null;
    };
  }, [body, note]);

  // ⌘S forces an immediate save and never lets the browser's save dialog
  // appear. Autosave usually already handled it — this is the reflex.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void note.flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [note]);

  if (state.status === "unreadable") {
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
        <span
          className="editor__saved"
          data-status={state.status === "ready" ? state.save : "clean"}
        >
          {STATUS_LABEL[state.status === "ready" ? state.save : "clean"]}
        </span>
        <span>{words} words</span>
        <span className="editor__disk">markdown · UTF-8 · LF</span>
      </div>
    </div>
  );
}
