// @vitest-environment jsdom
// The Tooltip wrapper over Base UI (ADR 0001): a trigger's label surfaces on
// hover and on keyboard focus. (delay=0 here so the popup shows synchronously
// under fake timers.)

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Tooltip, TooltipProvider } from "./Tooltip";

afterEach(cleanup);

function renderTip() {
  return render(
    <TooltipProvider delay={0}>
      <Tooltip label="Toggle sidebar">
        <button aria-label="Toggle sidebar">icon</button>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe("Tooltip", () => {
  it("shows the label on hover", async () => {
    renderTip();
    expect(screen.queryByText("Toggle sidebar")).toBeNull();
    const btn = screen.getByRole("button");
    fireEvent.pointerEnter(btn, { pointerType: "mouse" });
    fireEvent.mouseEnter(btn);
    await waitFor(() => expect(screen.getByText("Toggle sidebar")).toBeTruthy());
  });

  it("shows the label on keyboard focus", async () => {
    renderTip();
    fireEvent.focus(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Toggle sidebar")).toBeTruthy());
  });
});
