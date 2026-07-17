// Golden-file round-trip: opening a note and saving it untouched must be a
// byte no-op, and repeated round-trips must be stable. A serializer that
// reflows the file on every save quietly breaks Obiter's premise.
import { describe, expect, it } from "vite-plus/test";
import { htmlToMd, joinFrontmatter, mdToHtml, splitFrontmatter } from "./markdown";

const fixtures = import.meta.glob("./fixtures/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

// The app's real open→save path: split frontmatter off, convert only the
// body through the HTML editor pipeline, then re-attach. This is the unit
// the golden files must round-trip byte-for-byte.
function roundTrip(md: string): string {
  const { frontmatter, body } = splitFrontmatter(md);
  const converted = body.trim() ? htmlToMd(mdToHtml(body)) : body;
  return joinFrontmatter(frontmatter, converted);
}

describe("markdown round-trip (golden files)", () => {
  it("finds fixture notes", () => {
    expect(Object.keys(fixtures).length).toBeGreaterThan(0);
  });

  for (const [path, md] of Object.entries(fixtures)) {
    it(`open+save is a byte no-op: ${path}`, () => {
      expect(roundTrip(md)).toBe(md);
    });

    it(`stays stable across repeated round-trips: ${path}`, () => {
      let current = md;
      for (let i = 0; i < 3; i++) {
        current = roundTrip(current);
      }
      expect(current).toBe(md);
    });
  }
});

describe("splitFrontmatter", () => {
  it("returns no frontmatter for a plain note", () => {
    expect(splitFrontmatter("# Hi\n\nbody\n")).toEqual({
      frontmatter: "",
      body: "# Hi\n\nbody\n",
    });
  });

  it("splits the fenced block and absorbs the blank line before the body", () => {
    const md = "---\ntitle: X\n---\n\n# Body\n";
    const { frontmatter, body } = splitFrontmatter(md);
    expect(frontmatter).toBe("---\ntitle: X\n---\n\n");
    expect(body).toBe("# Body\n");
    expect(joinFrontmatter(frontmatter, body)).toBe(md);
  });

  it("handles a frontmatter-only note (no body)", () => {
    const md = "---\ntitle: X\n---\n";
    const { frontmatter, body } = splitFrontmatter(md);
    expect(frontmatter).toBe(md);
    expect(body).toBe("");
  });

  it("does not treat a lone leading thematic break as frontmatter", () => {
    // No closing fence — this is an <hr>, not frontmatter.
    const md = "---\n\nJust text after a rule.\n";
    expect(splitFrontmatter(md)).toEqual({ frontmatter: "", body: md });
  });
});

describe("htmlToMd", () => {
  it("normalizes to exactly one trailing newline", () => {
    expect(htmlToMd("<p>hi</p>")).toBe("hi\n");
    expect(htmlToMd("<p>hi</p>\n\n\n")).toBe("hi\n");
  });
});
