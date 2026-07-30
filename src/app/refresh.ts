// Refresh — noticing that the files changed underneath us.
//
// Obiter's notes are ordinary files, so another tool can change them while
// the app is open. Several parts of the app need to react to that: the
// notebook gate re-checks the folder is still there, the tree re-lists the
// folders on show, the open note picks up an outside edit. Before this
// module each of them listened to `window` itself, in whatever order React
// happened to register them, and the gate didn't listen at all.
//
// The one real dependency between them is a precondition: if the notebook
// isn't readable, everything else is doomed. That matters more than it
// sounds — a notebook on an unmounted volume doesn't fail fast, it hangs,
// so fanning out would mean one hang per expanded folder instead of one.
// Hence: check the precondition, stop if it fails, otherwise run the tasks
// concurrently since nothing orders them against each other.
//
// Framework-free and domain-free: it knows nothing about notebooks or
// notes, and registers no listeners. Callers drive `run`; RefreshProvider
// wires it to window focus, and a filesystem watcher (#18) becomes a second
// trigger without this module changing.

/** Why a refresh is happening. `watch` joins when #18 lands. */
export type RefreshReason = "focus" | "manual";

export interface Refresh {
  /**
   * Run a refresh, resolving once it settles.
   *
   * Coalescing: at most one sequence runs at a time. A call arriving while
   * one is in flight schedules exactly one more run afterwards, however many
   * arrive — bounded under a watcher storm, and never misses the final state
   * because the work is idempotent re-reads. The returned promise resolves
   * when the work this call is covered by has finished.
   */
  run(reason: RefreshReason): Promise<void>;
  /**
   * Register the precondition. Tasks are skipped entirely when it resolves
   * false (or rejects). At most one — registering again replaces it, which
   * is what a re-invoked effect does. Returns an unregister.
   */
  setPrecondition(check: () => Promise<boolean>): () => void;
  /**
   * Register work to do once the precondition passes. Tasks run
   * concurrently and independently: one failing never stops another, and a
   * failure is swallowed, since every subscriber's correct response to "I
   * couldn't re-read" is to leave what it has alone. Returns an unsubscribe.
   */
  subscribe(task: (reason: RefreshReason) => Promise<void> | void): () => void;
}

export function createRefresh(): Refresh {
  let precondition: (() => Promise<boolean>) | null = null;
  const tasks = new Set<(reason: RefreshReason) => Promise<void> | void>();

  let running: Promise<void> | null = null;
  /** A run was asked for while one was in flight; do exactly one more. */
  let pending: RefreshReason | null = null;

  async function sequence(reason: RefreshReason): Promise<void> {
    if (precondition !== null) {
      let ok: boolean;
      try {
        ok = await precondition();
      } catch {
        return; // treat a throwing precondition as "not now"
      }
      if (!ok) return;
    }
    // allSettled, not all: one task rejecting must not cancel the others.
    await Promise.allSettled([...tasks].map((task) => task(reason)));
  }

  async function drain(reason: RefreshReason): Promise<void> {
    let next: RefreshReason | null = reason;
    while (next !== null) {
      const current: RefreshReason = next;
      pending = null;
      await sequence(current);
      next = pending;
    }
    running = null;
  }

  return {
    run(reason) {
      if (running !== null) {
        // Collapse any number of triggers into a single follow-up run.
        pending = reason;
        return running;
      }
      running = drain(reason);
      return running;
    },

    setPrecondition(check) {
      precondition = check;
      return () => {
        if (precondition === check) precondition = null;
      };
    },

    subscribe(task) {
      tasks.add(task);
      return () => tasks.delete(task);
    },
  };
}
