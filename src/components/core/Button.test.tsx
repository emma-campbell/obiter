// @vitest-environment jsdom
// The Button + IconButton wrappers over Base UI (ADR 0001). We assert the
// wrapper contract — a real <button>, variant/size data-attributes for the CSS,
// aria-pressed for the icon toggle, disabled, click, and startIcon/label — not
// the pixels (those live in the co-located CSS).

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

afterEach(cleanup);

describe("Button", () => {
  it("renders a button with variant/size data-attributes and children", () => {
    render(
      <Button variant="solid" size="sm">
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("data-variant")).toBe("solid");
    expect(btn.getAttribute("data-size")).toBe("sm");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.className).toContain("btn");
  });

  it("defaults to outline/md", () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn.getAttribute("data-variant")).toBe("outline");
    expect(btn.getAttribute("data-size")).toBe("md");
  });

  it("fires onClick and honours disabled", () => {
    let clicks = 0;
    const { rerender } = render(<Button onClick={() => clicks++}>Go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(clicks).toBe(1);

    rerender(
      <Button onClick={() => clicks++} disabled>
        Go
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn).toHaveProperty("disabled", true);
    fireEvent.click(btn);
    expect(clicks).toBe(1);
  });

  it("keeps a caller's className alongside btn", () => {
    render(<Button className="mine">Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn.className).toContain("btn");
    expect(btn.className).toContain("mine");
  });
});

describe("IconButton", () => {
  it("renders with aria-label and reflects active via aria-pressed", () => {
    const { rerender } = render(<IconButton icon={Search} aria-label="Search" size="sm" />);
    const btn = screen.getByRole("button", { name: "Search" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("data-size")).toBe("sm");
    expect(btn.getAttribute("aria-pressed")).toBeNull();

    rerender(<IconButton icon={Search} aria-label="Search" active />);
    expect(screen.getByRole("button", { name: "Search" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("renders a custom iconNode when given", () => {
    render(<IconButton aria-label="Custom" iconNode={<span data-testid="glyph">x</span>} />);
    expect(screen.getByTestId("glyph")).toBeTruthy();
  });
});
