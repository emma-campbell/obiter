// Golden-file round-trip: opening a note and saving it untouched must be a
// byte no-op, and repeated round-trips must be stable. A serializer that
// reflows the file on every save quietly breaks Obiter's premise.
import { describe, expect, it } from "vite-plus/test";
import { htmlToMd, mdToHtml } from "./markdown";

const fixtures = import.meta.glob("./fixtures/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

describe("markdown round-trip (golden files)", () => {
  it("finds fixture notes", () => {
    expect(Object.keys(fixtures).length).toBeGreaterThan(0);
  });

  for (const [path, md] of Object.entries(fixtures)) {
    it(`open+save is a byte no-op: ${path}`, () => {
      const once = htmlToMd(mdToHtml(md));
      expect(once).toBe(md);
    });

    it(`stays stable across repeated round-trips: ${path}`, () => {
      let current = md;
      for (let i = 0; i < 3; i++) {
        current = htmlToMd(mdToHtml(current));
      }
      expect(current).toBe(md);
    });
  }
});

describe("htmlToMd", () => {
  it("normalizes to exactly one trailing newline", () => {
    expect(htmlToMd("<p>hi</p>")).toBe("hi\n");
    expect(htmlToMd("<p>hi</p>\n\n\n")).toBe("hi\n");
  });
});
