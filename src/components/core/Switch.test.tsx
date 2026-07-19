// @vitest-environment jsdom
// The Switch wrapper over Base UI (ADR 0001): a role="switch" toggle with a
// clickable label, controlled checked state, and disabled. Pixels live in the
// co-located CSS.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Switch } from "./Switch";

afterEach(cleanup);

describe("Switch", () => {
  it("renders a labelled switch reflecting checked state", () => {
    render(
      <Switch checked onCheckedChange={() => {}}>
        Enable AI features
      </Switch>,
    );
    const sw = screen.getByRole("switch", { name: "Enable AI features" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("fires onCheckedChange with the next value when toggled", () => {
    const seen: boolean[] = [];
    render(
      <Switch checked={false} onCheckedChange={(v) => seen.push(v)}>
        Show hidden files
      </Switch>,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Show hidden files" }));
    expect(seen).toEqual([true]);
  });

  it("toggles when the label text is clicked", () => {
    const seen: boolean[] = [];
    render(
      <Switch checked={false} onCheckedChange={(v) => seen.push(v)}>
        Show hidden files
      </Switch>,
    );
    fireEvent.click(screen.getByText("Show hidden files"));
    expect(seen).toEqual([true]);
  });

  it("does not fire when disabled", () => {
    const seen: boolean[] = [];
    render(
      <Switch checked={false} disabled onCheckedChange={(v) => seen.push(v)}>
        Off
      </Switch>,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Off" }));
    expect(seen).toEqual([]);
  });
});
