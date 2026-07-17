// Obiter — the markdown round-trip.
//
// Plain .md stays the source of truth by converting at the edges:
// markdown -> HTML on open, HTML -> markdown on save. The conversion runs on
// strings via remark/rehype, so ProseKit only ever sees HTML — no ProseMirror
// instance-duplication hazard, and the file on disk stays a .md you can `cat`.
//
// Determinism: remark-stringify is pinned to fixed options below so an
// untouched open+save is a no-op on the bytes. The guarantee is enforced by
// the golden-file round-trip test in markdown.test.ts — a serializer that
// reflows the file on every save quietly breaks Obiter's premise.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify, { type Options as RemarkStringifyOptions } from "remark-stringify";

const MD_OUT: RemarkStringifyOptions = {
  bullet: "-",
  emphasis: "_",
  strong: "*",
  fence: "`",
  fences: true,
  listItemIndent: "one",
  rule: "-",
  tightDefinitions: true,
};

// GFM (tables, task lists, strikethrough) on both directions so those
// constructs survive the round-trip. Frontmatter is handled separately —
// it has no HTML representation, so it's split off before conversion (see
// splitFrontmatter) rather than run through this pipeline.

export function mdToHtml(md: string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(md),
  );
}

export function htmlToMd(html: string): string {
  const out = String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeRemark)
      .use(remarkGfm)
      .use(remarkStringify, MD_OUT)
      .processSync(html),
  );
  return out.replace(/\n+$/, "") + "\n";
}

// Leading YAML frontmatter: `---` fence, body, closing `---` fence — the
// note-metadata convention. It has no HTML representation and must never
// reach the editor, so it's split off verbatim on open and re-attached on
// save. The regex also absorbs any blank lines between the closing fence
// and the first body content, so re-attaching reproduces the exact bytes.
const FRONTMATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n(?:[ \t]*\r?\n)*|$)/;

export interface SplitNote {
  /** The frontmatter block including its fences and trailing blank lines, or "" if none. */
  frontmatter: string;
  /** Everything after the frontmatter — the markdown that goes through the editor. */
  body: string;
}

export function splitFrontmatter(md: string): SplitNote {
  const match = md.match(FRONTMATTER);
  if (!match) return { frontmatter: "", body: md };
  return { frontmatter: match[0], body: md.slice(match[0].length) };
}

export function joinFrontmatter(frontmatter: string, body: string): string {
  return frontmatter + body;
}
