// @vitest-environment jsdom
// The autosave hook: debounce, coalescing, flush (⌘S / blur / unmount),
// the clean baseline, and error-with-retry — all over a mocked write, no
// editor involved.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useAutosave } from "./useAutosave";

/** A mutable content source standing in for the editor's getMarkdown. */
function source(initial = "") {
  const box = { value: initial };
  return { box, read: () => box.value };
}

afterEach(() => vi.restoreAllMocks());

describe("useAutosave", () => {
  it("writes the current content a moment after a change", async () => {
    const { box, read } = source("a");
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ read, write }));

    act(() => result.current.markSaved("a"));
    box.value = "ab";
    act(() => result.current.schedule());

    await waitFor(() => expect(write).toHaveBeenCalledWith("ab"));
    await waitFor(() => expect(result.current.status).toBe("saved"));
  });

  it("coalesces rapid changes into a single write", async () => {
    const { box, read } = source("");
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ read, write }));
    act(() => result.current.markSaved(""));

    box.value = "a";
    act(() => result.current.schedule());
    box.value = "ab";
    act(() => result.current.schedule());
    box.value = "abc";
    act(() => result.current.schedule());

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write).toHaveBeenCalledWith("abc");
  });

  it("does not write when content is unchanged from the last save", async () => {
    const { read } = source("same");
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ read, write }));
    act(() => result.current.markSaved("same"));

    act(() => result.current.flush());
    await new Promise((r) => setTimeout(r, 20));
    expect(write).not.toHaveBeenCalled();
  });

  it("flush writes immediately, bypassing the debounce", async () => {
    const { box, read } = source("x");
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ read, write }));
    act(() => result.current.markSaved("x"));

    box.value = "xy";
    act(() => result.current.flush());
    await waitFor(() => expect(write).toHaveBeenCalledWith("xy"));
  });

  it("flushes on window blur", async () => {
    const { box, read } = source("x");
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ read, write }));
    act(() => result.current.markSaved("x"));

    box.value = "xy";
    act(() => window.dispatchEvent(new Event("blur")));
    await waitFor(() => expect(write).toHaveBeenCalledWith("xy"));
  });

  it("keeps the buffer and retries after a failed write", async () => {
    const { box, read } = source("x");
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ read, write }));
    act(() => result.current.markSaved("x"));

    box.value = "xy";
    act(() => result.current.flush());
    await waitFor(() => expect(result.current.status).toBe("error"));

    // The buffer wasn't discarded — a later flush retries and succeeds.
    act(() => result.current.flush());
    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith("xy");
  });

  it("reloads on focus when the note changed on disk and the buffer is clean", async () => {
    const { read } = source("v1");
    const write = vi.fn().mockResolvedValue(undefined);
    const readDisk = vi.fn().mockResolvedValue("v2"); // changed externally
    const applyReload = vi.fn();
    const { result } = renderHook(() => useAutosave({ read, write, readDisk, applyReload }));
    act(() => result.current.markSaved("v1")); // baseline v1, buffer clean

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(applyReload).toHaveBeenCalledWith("v2");
  });

  it("keeps a dirty buffer on focus even when disk changed", async () => {
    const { box, read } = source("v1");
    const write = vi.fn().mockResolvedValue(undefined);
    const readDisk = vi.fn().mockResolvedValue("v2");
    const applyReload = vi.fn();
    const { result } = renderHook(() => useAutosave({ read, write, readDisk, applyReload }));
    act(() => result.current.markSaved("v1"));
    box.value = "v1 with my edits"; // buffer is now dirty

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(applyReload).not.toHaveBeenCalled();
  });

  it("does nothing on focus when the note is unchanged on disk", async () => {
    const { read } = source("v1");
    const write = vi.fn().mockResolvedValue(undefined);
    const readDisk = vi.fn().mockResolvedValue("v1"); // same as baseline
    const applyReload = vi.fn();
    const { result } = renderHook(() => useAutosave({ read, write, readDisk, applyReload }));
    act(() => result.current.markSaved("v1"));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(applyReload).not.toHaveBeenCalled();
  });

  it("flushes pending edits on unmount", async () => {
    const { box, read } = source("x");
    const write = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutosave({ read, write }));
    act(() => result.current.markSaved("x"));

    box.value = "xy";
    act(() => result.current.schedule());
    // Unmount before the debounce fires — the pending edit must still land
    // via the editor's flush-before-destroy (simulated here by flush()).
    act(() => result.current.flush());
    unmount();

    await waitFor(() => expect(write).toHaveBeenCalledWith("xy"));
  });
});
