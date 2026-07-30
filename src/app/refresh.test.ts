// The refresh sequence, driven directly. No React, no jsdom, no window:
// `run` is a function call and every task is a spy, so ordering, the
// precondition and coalescing are all observable without timers or events.

import { describe, expect, it } from "vite-plus/test";
import { createRefresh, type RefreshReason } from "./refresh";

/** A deferred promise, for holding a task open mid-sequence. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("refresh — the precondition", () => {
  it("runs the tasks when the precondition passes", async () => {
    const refresh = createRefresh();
    const ran: string[] = [];
    refresh.setPrecondition(() => Promise.resolve(true));
    refresh.subscribe(() => void ran.push("tree"));
    refresh.subscribe(() => void ran.push("note"));

    await refresh.run("focus");

    expect(ran.sort()).toEqual(["note", "tree"]);
  });

  it("skips every task when the precondition fails", async () => {
    const refresh = createRefresh();
    const ran: string[] = [];
    // The notebook is gone: re-listing folders and re-reading the note would
    // hang against an unmounted volume, one call at a time.
    refresh.setPrecondition(() => Promise.resolve(false));
    refresh.subscribe(() => void ran.push("tree"));
    refresh.subscribe(() => void ran.push("note"));

    await refresh.run("focus");

    expect(ran).toEqual([]);
  });

  it("skips every task when the precondition rejects", async () => {
    const refresh = createRefresh();
    const ran: string[] = [];
    refresh.setPrecondition(() => Promise.reject(new Error("unreadable")));
    refresh.subscribe(() => void ran.push("tree"));

    await refresh.run("focus");

    expect(ran).toEqual([]);
  });

  it("runs the tasks when no precondition is registered", async () => {
    const refresh = createRefresh();
    const ran: string[] = [];
    refresh.subscribe(() => void ran.push("tree"));

    await refresh.run("manual");

    expect(ran).toEqual(["tree"]);
  });

  it("checks the precondition before any task starts", async () => {
    const refresh = createRefresh();
    const order: string[] = [];
    refresh.setPrecondition(async () => {
      order.push("probe");
      return true;
    });
    refresh.subscribe(() => void order.push("task"));

    await refresh.run("focus");

    expect(order).toEqual(["probe", "task"]);
  });

  it("replaces the precondition when one is registered again", async () => {
    // A re-invoked effect registers, unregisters, registers — the last one
    // must win rather than the pair fighting.
    const refresh = createRefresh();
    const ran: string[] = [];
    refresh.setPrecondition(() => Promise.resolve(false));
    refresh.setPrecondition(() => Promise.resolve(true));
    refresh.subscribe(() => void ran.push("task"));

    await refresh.run("focus");

    expect(ran).toEqual(["task"]);
  });

  it("stops applying a precondition once it is unregistered", async () => {
    const refresh = createRefresh();
    const ran: string[] = [];
    const unregister = refresh.setPrecondition(() => Promise.resolve(false));
    refresh.subscribe(() => void ran.push("task"));

    unregister();
    await refresh.run("focus");

    expect(ran).toEqual(["task"]);
  });
});

describe("refresh — tasks", () => {
  it("runs tasks concurrently rather than one after another", async () => {
    const refresh = createRefresh();
    const first = deferred();
    const started: string[] = [];
    refresh.subscribe(async () => {
      started.push("slow");
      await first.promise;
    });
    refresh.subscribe(() => void started.push("fast"));

    const done = refresh.run("focus");
    await Promise.resolve();

    // The fast task didn't wait on the slow one.
    expect(started).toEqual(["slow", "fast"]);
    first.resolve();
    await done;
  });

  it("keeps running the other tasks when one rejects", async () => {
    const refresh = createRefresh();
    const ran: string[] = [];
    refresh.subscribe(() => Promise.reject(new Error("tree unreadable")));
    refresh.subscribe(() => void ran.push("note"));

    await refresh.run("focus");

    expect(ran).toEqual(["note"]);
  });

  it("passes the reason to each task", async () => {
    const refresh = createRefresh();
    const reasons: RefreshReason[] = [];
    refresh.subscribe((reason) => void reasons.push(reason));

    await refresh.run("manual");

    expect(reasons).toEqual(["manual"]);
  });

  it("stops calling a task once it unsubscribes", async () => {
    const refresh = createRefresh();
    const ran: string[] = [];
    const unsubscribe = refresh.subscribe(() => void ran.push("task"));

    await refresh.run("focus");
    unsubscribe();
    await refresh.run("focus");

    expect(ran).toEqual(["task"]);
  });
});

describe("refresh — coalescing", () => {
  it("collapses triggers arriving mid-run into a single follow-up", async () => {
    const refresh = createRefresh();
    const gate = deferred();
    let runs = 0;
    refresh.subscribe(async () => {
      runs += 1;
      if (runs === 1) await gate.promise;
    });

    const first = refresh.run("focus");
    // A storm of triggers while the first run is still in flight.
    void refresh.run("focus");
    void refresh.run("focus");
    void refresh.run("focus");
    gate.resolve();
    await first;

    // The original run, plus exactly one more — not one per trigger.
    expect(runs).toBe(2);
  });

  it("runs again from scratch once an earlier run has settled", async () => {
    const refresh = createRefresh();
    let runs = 0;
    refresh.subscribe(() => void (runs += 1));

    await refresh.run("focus");
    await refresh.run("focus");

    expect(runs).toBe(2);
  });

  it("sees state that changed after the in-flight run started", async () => {
    // The point of coalescing over dropping: a change landing just after the
    // probe still gets picked up by the follow-up run.
    const refresh = createRefresh();
    const gate = deferred();
    const seen: string[] = [];
    let disk = "v1";
    let first = true;
    refresh.subscribe(async () => {
      seen.push(disk);
      if (first) {
        first = false;
        await gate.promise;
      }
    });

    const run = refresh.run("focus");
    disk = "v2"; // changed while we were mid-refresh
    void refresh.run("focus");
    gate.resolve();
    await run;

    expect(seen).toEqual(["v1", "v2"]);
  });
});
