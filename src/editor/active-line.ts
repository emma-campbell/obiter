// Active-line highlight: a node decoration on the textblock that holds the
// caret. The editor shows focus by marking your line, not by outlining the
// whole writing surface. Styling lives in NoteView.css (.obiter-active-line),
// gated on .ProseMirror-focused so the wash disappears when focus leaves.

import { definePlugin, type Extension } from "prosekit/core";
import { Plugin, PluginKey } from "prosekit/pm/state";
import { Decoration, DecorationSet } from "prosekit/pm/view";

export function defineActiveLine(): Extension {
  return definePlugin(
    new Plugin({
      key: new PluginKey("obiterActiveLine"),
      props: {
        decorations(state) {
          const { selection } = state;
          // caret only — a range selection already reads via ::selection
          if (!selection.empty) return null;
          const $pos = selection.$from;
          if ($pos.depth === 0) return null;
          const pos = $pos.before($pos.depth);
          const node = $pos.parent;
          return DecorationSet.create(state.doc, [
            Decoration.node(pos, pos + node.nodeSize, { class: "obiter-active-line" }),
          ]);
        },
      },
    }),
  );
}
