// Obiter — [[wikilink]] support for the markdown round-trip and the editor.
//
// remark has no notion of [[ ]], so a raw wikilink is just text — and
// remark-stringify escapes leading brackets, turning [[foo]] into \[\[foo]]
// on the first save. Everything here exists to keep that from happening:
// wikilinks become a first-class inline node inside the pipeline, carried
// through HTML as <a data-wikilink>, and serialized back verbatim.
//
// The node keeps the target exactly as written (including any #heading
// part); resolving it against the notebook is the caller's business, not
// the conversion's.

import { defineMarkSpec } from "prosekit/core";

/** A parsed [[target]] or [[target|display]] inline node (mdast-level). */
export interface Wikilink {
  type: "wikilink";
  /** What was written before the pipe, verbatim. */
  target: string;
  /** The text shown: the alias if one was written, else the target. */
  display: string;
  /** Whether the source spelled a pipe — so [[t|t]] round-trips exactly. */
  alias: boolean;
  /** An Obsidian ![[embed]]. Rendered as a plain link for now, but the bang
   *  must ride inside the node — left in a text node the serializer would
   *  escape it to \! and break the byte round-trip. */
  embed: boolean;
}

// Target: no brackets, pipes, or newlines. Display: everything after the
// FIRST pipe, so [[t|a|b]] shows "a|b" (Obsidian's rule). Both non-empty.
const WIKILINK = /(!?)\[\[([^[\]|\n]+)(?:\|([^[\]\n]+))?\]\]/g;

interface TextNode {
  type: "text";
  value: string;
}

interface ParentNode {
  type: string;
  children: Array<TextNode | Wikilink | ParentNode>;
}

function isParent(node: unknown): node is ParentNode {
  return Array.isArray((node as ParentNode).children);
}

/** A link node smuggling a wikilink out of hast-util-to-mdast (see below). */
function smuggledWikilink(node: unknown): Wikilink | undefined {
  const candidate = node as { type: string; data?: { wikilink?: Wikilink } };
  return candidate.type === "link" ? candidate.data?.wikilink : undefined;
}

/** Split one text node into text/wikilink runs; null if it holds none. */
function splitText(node: TextNode): Array<TextNode | Wikilink> | null {
  const out: Array<TextNode | Wikilink> = [];
  let last = 0;
  WIKILINK.lastIndex = 0;
  for (let m = WIKILINK.exec(node.value); m !== null; m = WIKILINK.exec(node.value)) {
    if (m.index > last) out.push({ type: "text", value: node.value.slice(last, m.index) });
    const [, bang, target, display] = m;
    out.push({
      type: "wikilink",
      target,
      display: display ?? target,
      alias: display !== undefined,
      embed: bang === "!",
    });
    last = m.index + m[0].length;
  }
  if (out.length === 0) return null;
  if (last < node.value.length) out.push({ type: "text", value: node.value.slice(last) });
  return out;
}

/**
 * remark plugin: turn [[ ]] spans inside text nodes into wikilink nodes.
 * Runs after parsing (markdown → HTML) AND after rehype-remark (HTML →
 * markdown), so a wikilink typed as plain text in the editor is recognized
 * on save instead of being bracket-escaped. Code spans and blocks hold
 * their text in `value`, not children, so they are naturally untouched.
 */
export function remarkWikilinks() {
  return (tree: unknown): void => {
    if (!isParent(tree)) return;
    const walk = (parent: ParentNode): void => {
      const next: ParentNode["children"] = [];
      for (const child of parent.children) {
        const smuggled = smuggledWikilink(child);
        const split = child.type === "text" ? splitText(child as TextNode) : null;
        if (smuggled) {
          next.push(smuggled);
        } else if (split) {
          next.push(...split);
        } else {
          if (isParent(child)) walk(child);
          next.push(child);
        }
      }
      parent.children = next;
    };
    walk(tree);
  };
}

// HTML carrier: <a class="wikilink" data-wikilink="target">display</a>,
// plus an empty data-wikilink-alias attribute when the source had a pipe.
// An <a> so the editor treats it as a link-shaped inline; no href, so the
// ordinary link mark (which matches a[href]) never claims it.

interface HastElement {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: Array<{ type: string; value?: string; children?: unknown[] }>;
}

/** mdast → hast handler for the wikilink node (markdown → HTML direction). */
export function wikilinkToHast(_state: unknown, node: Wikilink): HastElement {
  const properties: Record<string, unknown> = {
    className: ["wikilink"],
    dataWikilink: node.target,
  };
  if (node.alias) properties.dataWikilinkAlias = "";
  if (node.embed) properties.dataWikilinkEmbed = "";
  return {
    type: "element",
    tagName: "a",
    properties,
    children: [{ type: "text", value: node.display }],
  };
}

function textOf(node: { value?: string; children?: unknown[] }): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? [])
    .map((child) => textOf(child as { value?: string; children?: unknown[] }))
    .join("");
}

interface ToMdastState {
  all(element: HastElement): unknown[];
  patch(from: unknown, to: unknown): void;
  resolve(url: string | null): string;
}

/**
 * hast → mdast handler for <a> (HTML → markdown direction). A registered
 * handler fully replaces the default — returning undefined means "drop the
 * node", not "fall back" — so this covers both cases: a[data-wikilink]
 * becomes a wikilink, and any other anchor gets the stock link conversion,
 * mirroring hast-util-to-mdast's own `a` handler.
 *
 * The wikilink comes back SMUGGLED inside an ordinary link node
 * (data.wikilink) rather than as itself: hast-util-to-mdast wraps whatever
 * it doesn't recognize as phrasing into its own block, which would split a
 * list item around every wikilink. The remarkWikilinks pass that follows
 * unwraps it once the tree's block structure is settled.
 */
export function wikilinkOrLinkFromHast(state: ToMdastState, element: HastElement): unknown {
  const target = element.properties.dataWikilink;
  if (typeof target === "string") {
    const display = textOf(element) || target;
    const wikilink: Wikilink = {
      type: "wikilink",
      target,
      display,
      // A pipe is emitted when the source had one, or when the display text
      // was edited away from the target and needs one to survive.
      alias: element.properties.dataWikilinkAlias != null || display !== target,
      embed: element.properties.dataWikilinkEmbed != null,
    };
    const carrier = {
      type: "link",
      url: "",
      title: null,
      children: [{ type: "text", value: display }],
      data: { wikilink },
    };
    state.patch(element, carrier);
    return carrier;
  }
  const properties = element.properties;
  const result = {
    type: "link",
    url: state.resolve(String(properties.href ?? "") || null),
    title: properties.title ? String(properties.title) : null,
    children: state.all(element),
  };
  state.patch(element, result);
  return result;
}

/** mdast → markdown handler: emit the wikilink verbatim, no escaping. */
export function wikilinkToMarkdown(node: Wikilink): string {
  const bang = node.embed ? "!" : "";
  return node.alias ? `${bang}[[${node.target}|${node.display}]]` : `${bang}[[${node.target}]]`;
}

/**
 * The editor-side mark. Parses and re-emits the same <a data-wikilink>
 * carrier the pipeline speaks, so getMarkdown() hands htmlToMd exactly
 * what mdToHtml produced. Non-inclusive: typing at the edge of a link
 * shouldn't extend it.
 */
export function defineWikilinkSpec() {
  return defineMarkSpec({
    name: "wikilink",
    attrs: { target: { default: "" }, alias: { default: false }, embed: { default: false } },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[data-wikilink]",
        getAttrs: (node: HTMLElement) => ({
          target: node.getAttribute("data-wikilink") ?? "",
          alias: node.hasAttribute("data-wikilink-alias"),
          embed: node.hasAttribute("data-wikilink-embed"),
        }),
      },
    ],
    toDOM: (mark) => [
      "a",
      {
        class: "wikilink",
        "data-wikilink": String(mark.attrs.target),
        ...(mark.attrs.alias ? { "data-wikilink-alias": "" } : {}),
        ...(mark.attrs.embed ? { "data-wikilink-embed": "" } : {}),
      },
      0,
    ],
  });
}
