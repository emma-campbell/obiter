import { describe, expect, it } from "vite-plus/test";
import type { Entry } from "./notebook";
import { noteRef, resolveWikilink } from "./wikilinks";

const file = (path: string): Entry => ({
  name: path.split("/").pop() ?? path,
  path,
  kind: "file",
});

/** A fake of the backend filename search: case-insensitive substring. */
const searchOver =
  (entries: Entry[]) =>
  (query: string): Promise<Entry[]> =>
    Promise.resolve(entries.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())));

describe("noteRef", () => {
  it("drops a heading reference and surrounding space", () => {
    expect(noteRef("Dumplings#Folding")).toBe("Dumplings");
    expect(noteRef(" Dumplings ")).toBe("Dumplings");
    expect(noteRef("Dumplings")).toBe("Dumplings");
  });
});

describe("resolveWikilink", () => {
  const notebook = [
    file("recipes/dumplings.md"),
    file("drafts/dumplings.md"),
    file("stock.md"),
    file("recipes/stock.md"),
    file("notes.md"),
  ];
  const search = searchOver(notebook);

  it("matches a bare name against the filename stem, case-insensitively", async () => {
    const hit = await resolveWikilink("Stock", search);
    expect(hit?.path).toBe("stock.md");
  });

  it("requires a pathed target to match the path tail", async () => {
    const hit = await resolveWikilink("recipes/dumplings", search);
    expect(hit?.path).toBe("recipes/dumplings.md");
  });

  it("prefers the shallowest path, then the lexicographically first", async () => {
    expect((await resolveWikilink("stock", search))?.path).toBe("stock.md");
    expect((await resolveWikilink("dumplings", search))?.path).toBe("drafts/dumplings.md");
  });

  it("ignores a heading reference when resolving", async () => {
    const hit = await resolveWikilink("stock#Reduction", search);
    expect(hit?.path).toBe("stock.md");
  });

  it("accepts a target written with its extension", async () => {
    const hit = await resolveWikilink("stock.md", search);
    expect(hit?.path).toBe("stock.md");
  });

  it("returns null when nothing matches", async () => {
    expect(await resolveWikilink("croissants", search)).toBeNull();
    expect(await resolveWikilink("kitchen/dumplings", search)).toBeNull();
    expect(await resolveWikilink("  ", search)).toBeNull();
    expect(await resolveWikilink("#just-a-heading", search)).toBeNull();
  });

  it("never resolves to a folder", async () => {
    const withFolder = searchOver([
      { name: "dumplings", path: "dumplings", kind: "folder" },
      ...notebook,
    ]);
    expect((await resolveWikilink("dumplings", withFolder))?.kind).toBe("file");
  });
});
