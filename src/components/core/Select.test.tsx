// @vitest-environment jsdom
// The Select wrapper over Base UI (ADR 0001): the trigger shows the selected
// option's label, and choosing another item fires onValueChange with its value.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Select } from "./Select";

afterEach(cleanup);

const OPTIONS = [
  { value: "trash", label: "Move to system trash" },
  { value: "permanent", label: "Delete permanently" },
] as const;

describe("Select", () => {
  it("shows the selected option's label on the trigger", () => {
    render(
      <Select
        aria-label="Delete behavior"
        value="trash"
        onValueChange={() => {}}
        options={OPTIONS}
      />,
    );
    expect(screen.getByLabelText("Delete behavior").textContent).toContain("Move to system trash");
  });

  it("fires onValueChange with the chosen value", () => {
    const seen: string[] = [];
    render(
      <Select
        aria-label="Delete behavior"
        value="trash"
        onValueChange={(v) => seen.push(v)}
        options={OPTIONS}
      />,
    );
    fireEvent.click(screen.getByLabelText("Delete behavior"));
    // Base UI commits on the pointer sequence, not a bare click.
    const option = screen.getByRole("option", { name: "Delete permanently" });
    fireEvent.pointerDown(option);
    fireEvent.pointerUp(option);
    fireEvent.click(option);
    expect(seen).toEqual(["permanent"]);
  });
});
