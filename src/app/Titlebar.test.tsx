// @vitest-environment jsdom
// The titlebar's window chrome is platform-dependent: macOS gets native
// traffic lights over the overlay bar, Linux runs undecorated and needs the
// bar to carry its own minimize/maximize/close, and a plain browser gets
// neither. These tests pin that split and the wiring of the Linux controls
// to the real window plugin commands.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Titlebar } from "./Titlebar";

const LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36";
const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";

const originalUA = navigator.userAgent;
function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

const titlebar = () => (
  <Titlebar
    path="obiter"
    sidebarOpen
    onToggleSidebar={() => {}}
    onSearch={() => {}}
    onSettings={() => {}}
  />
);

afterEach(() => {
  cleanup();
  clearMocks();
  setUserAgent(originalUA);
});

describe("Titlebar window controls", () => {
  it("draws no window controls in a plain browser", () => {
    setUserAgent(LINUX_UA);
    render(titlebar());
    expect(screen.queryByLabelText("Close window")).toBeNull();
  });

  it("draws no window controls on macOS, where the traffic lights are native", () => {
    setUserAgent(MAC_UA);
    mockWindows("main");
    mockIPC(() => null);
    render(titlebar());
    expect(screen.queryByLabelText("Close window")).toBeNull();
  });

  it("carries minimize/maximize/close on the undecorated Linux window", () => {
    setUserAgent(LINUX_UA);
    mockWindows("main");
    const commands: string[] = [];
    mockIPC((cmd) => {
      commands.push(cmd);
      return null;
    });
    render(titlebar());

    fireEvent.click(screen.getByLabelText("Minimize window"));
    fireEvent.click(screen.getByLabelText("Maximize window"));
    fireEvent.click(screen.getByLabelText("Close window"));

    expect(commands).toEqual([
      "plugin:window|minimize",
      "plugin:window|toggle_maximize",
      "plugin:window|close",
    ]);
  });
});
