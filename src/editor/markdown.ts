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

export function mdToHtml(md: string): string {
  return String(unified().use(remarkParse).use(remarkRehype).use(rehypeStringify).processSync(md));
}

export function htmlToMd(html: string): string {
  const out = String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeRemark)
      .use(remarkStringify, MD_OUT)
      .processSync(html),
  );
  return out.replace(/\n+$/, "") + "\n";
}
