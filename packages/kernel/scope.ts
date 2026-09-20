import { decode, type Dispose, type Scope, type TSchema } from "@fathom/sdk";

export const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;
export const DEFAULT_CLEANUP_TIMEOUT_MS = 5_000;
const SETTLE_POLL_INTERVAL_MS = 20;

export class PluginScope implements Scope {
  private controller = new AbortController();
  readonly signal = this.controller.signal;
  accepting = true;
  private disposers: Dispose[] = [];
  private work = new Set<Promise<unknown>>();
  private pins = 0;
  private produce?: () => unknown;
  private committed = false;
  private staged: { activate: () => void; notify: () => void }[] = [];

  constructor(
    readonly id: string,
    private onError: (e: unknown) => void,
  ) {}

  defer(fn: Dispose) {
    if (!this.accepting) {
      throw new Error(`${this.id} is stopping`);
    }

    this.disposers.push(fn);
  }

  task(fn: (signal: AbortSignal) => Promise<void>) {
    if (!this.accepting) {
      throw new Error(`${this.id} is stopping`);
    }

    const task = Promise.resolve()
      .then(() => fn(this.signal))
      .catch((e) => {
        if (!this.signal.aborted) {
          this.onError(e);
        }
      })
      .finally(() => this.work.delete(task));

    this.work.add(task);
  }

  handoff(schema: TSchema, produce: () => unknown) {
    this.produce = () => decode(schema, produce());
  }

  snapshot(): unknown {
    return this.produce?.();
  }

  stage(activate: () => void, notify: () => void) {
    if (this.committed) {
      activate();
      notify();
    } else {
      this.staged.push({ activate, notify });
    }
  }

  commit() {
    for (const item of this.staged) {
      item.activate();
    }

    this.committed = true;

    for (const item of this.staged) {
      item.notify();
    }

    this.staged = [];
  }

  pin(): () => void {
    if (!this.accepting) {
      throw new Error(`${this.id} is stopping`);
    }

    this.pins++;

    let done = false;

    return () => {
      if (!done) {
        done = true;
        this.pins--;
      }
    };
  }

  async stop(
    drainMs = DEFAULT_DRAIN_TIMEOUT_MS,
    cleanupMs = DEFAULT_CLEANUP_TIMEOUT_MS,
    beforeDispose?: () => void,
  ) {
    this.accepting = false;

    const settle = async (ms: number) => {
      const end = Date.now() + ms;

      while ((this.work.size || this.pins) && Date.now() < end) {
        await new Promise((resolve) =>
          setTimeout(resolve, SETTLE_POLL_INTERVAL_MS),
        );
      }
    };

    await settle(drainMs);
    this.controller.abort();
    await settle(cleanupMs);

    if (this.work.size || this.pins) {
      throw new Error("Work did not settle; restart required");
    }

    beforeDispose?.();

    const errors: unknown[] = [];

    for (const dispose of this.disposers.reverse()) {
      let timer: ReturnType<typeof setTimeout> | undefined;

      try {
        await Promise.race([
          Promise.resolve().then(dispose),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Cleanup timed out; restart required")),
              cleanupMs,
            );
          }),
        ]);
      } catch (error) {
        errors.push(error);
      } finally {
        clearTimeout(timer);
      }
    }

    this.disposers = [];
    this.staged = [];

    if (errors.length) {
      throw new AggregateError(errors, "Cleanup failed; restart required");
    }
  }
}
