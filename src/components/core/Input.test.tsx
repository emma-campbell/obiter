// @vitest-environment jsdom
// The Input wrapper over Base UI (ADR 0001): a real <input> with size/mono
// data-attributes, aria-invalid wiring, and native value/onChange passthrough.
// Focus/hover/invalid pixels live in the co-located CSS.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Input } from "./Input";

afterEach(cleanup);

describe("Input", () => {
  it("renders an input carrying size/mono data-attributes", () => {
    render(<Input aria-label="Path" mono size="sm" readOnly value="x" />);
    const input = screen.getByLabelText("Path");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("data-size")).toBe("sm");
    expect(input.getAttribute("data-mono")).toBe("true");
  });

  it("reflects invalid via aria-invalid", () => {
    render(<Input aria-label="Field" invalid readOnly value="x" />);
    expect(screen.getByLabelText("Field").getAttribute("aria-invalid")).toBe("true");
  });

  it("forwards native value/onChange (controlled)", () => {
    function Controlled() {
      const [v, setV] = useState("");
      return <Input aria-label="Name" value={v} onChange={(e) => setV(e.target.value)} />;
    }
    render(<Controlled />);
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    expect(input.value).toBe("hello");
  });
});
