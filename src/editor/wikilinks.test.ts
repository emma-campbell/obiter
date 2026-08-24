// Wikilink conversion behavior. The byte-stability of whole notes is the
// golden-file tests' job (fixtures/wikilinks.md); these pin the observable
// pieces — how [[ ]] renders, and how the HTML carrier serializes back.
import { describe, expect, it } from "vite-plus/test";
import { htmlToMd, mdToHtml } from "./markdown";

describe("mdToHtml wikilinks", () => {
  it("renders [[target]] as an anchor carrying the target", () => {
    const html = mdToHtml("See [[Dumplings]] for more.\n");
    expect(html).toContain('<a class="wikilink" data-wikilink="Dumplings">Dumplings</a>');
  });

  it("renders the alias as the visible text", () => {
    const html = mdToHtml("[[Dumplings|those little guys]]\n");
    expect(html).toContain('data-wikilink="Dumplings"');
    expect(html).toContain(">those little guys</a>");
    expect(html).toContain("data-wikilink-alias");
  });

  it("leaves code spans and blocks alone", () => {
    expect(mdToHtml("`[[x]]`\n")).not.toContain("data-wikilink");
    expect(mdToHtml("```\n[[x]]\n```\n")).not.toContain("data-wikilink");
  });

  it("does not link across an unclosed bracket pair", () => {
    expect(mdToHtml("just [[ half open\n")).not.toContain("data-wikilink");
  });
});

describe("htmlToMd wikilinks", () => {
  it("serializes the anchor carrier back to [[target]]", () => {
    expect(htmlToMd('<p><a data-wikilink="Dumplings">Dumplings</a></p>')).toBe("[[Dumplings]]\n");
  });

  it("keeps an alias when the source spelled a pipe", () => {
    expect(htmlToMd('<p><a data-wikilink="D" data-wikilink-alias="">D</a></p>')).toBe("[[D|D]]\n");
  });

  it("grows a pipe when the display text was edited away from the target", () => {
    expect(htmlToMd('<p><a data-wikilink="Dumplings">dump</a></p>')).toBe("[[Dumplings|dump]]\n");
  });

  it("recognizes a wikilink typed as plain text instead of escaping it", () => {
    // Without the mdast-side pass this would come back as \[\[Dumplings]].
    expect(htmlToMd("<p>see [[Dumplings]]</p>")).toBe("see [[Dumplings]]\n");
  });

  it("still converts ordinary anchors as links", () => {
    expect(htmlToMd('<p><a href="https://x.dev" title="t">x</a></p>')).toBe(
      '[x](https://x.dev "t")\n',
    );
  });
});
