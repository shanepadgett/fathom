import type { loadNativeBrowser } from "./native-browser.ts";

type NativeApi = NonNullable<ReturnType<typeof loadNativeBrowser>>;

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 25));

/** Owns native child handles for one explicit desktop window. */
export class NativeBrowserHost {
  private readonly children = new Set<bigint>();
  private closing = false;

  constructor(
    private api: NativeApi,
    private parent: number,
  ) {}

  async create() {
    if (this.closing) throw new Error("The desktop window is closing");
    const handle = this.api.create(this.parent);
    if (!handle) throw new Error("Native browser creation was rejected");
    this.children.add(handle);
    try {
      await this.wait(handle, 2);
    } catch (error) {
      try {
        await this.dispose(handle);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], "Native browser creation and cleanup failed");
      }
      throw error;
    }
    let disposed = false;
    const ready = () => {
      if (disposed || this.closing || this.api.state(handle) !== 2) {
        throw new Error("The native browser is no longer available");
      }
    };
    return {
      send: (message: string) => {
        ready();
        this.accept(this.api.send(handle, message));
      },
      poll: (output: Uint8Array, length: Uint32Array) => {
        ready();
        return this.api.poll(handle, output, length);
      },
      bounds: (x: number, y: number, width: number, height: number, visible: boolean) => {
        ready();
        this.accept(this.api.bounds(handle, x, y, width, height, visible));
      },
      navigate: (url: string) => {
        ready();
        this.accept(this.api.navigate(handle, url));
      },
      dispose: async () => {
        disposed = true;
        await this.dispose(handle);
      },
    };
  }

  async close() {
    this.closing = true;
    const outcomes = await Promise.allSettled(
      [...this.children].map((handle) => this.dispose(handle)),
    );
    const failures = outcomes.filter((result) => result.status === "rejected");
    if (failures.length) {
      throw new AggregateError(
        failures.map((result) => result.reason),
        "Native browsers did not finish closing",
      );
    }
  }

  private async dispose(handle: bigint) {
    this.accept(this.api.dispose(handle));
    await this.wait(handle, 0);
    this.children.delete(handle);
  }

  private accept(result: number) {
    if (result !== 0) {
      throw new Error(`Native browser operation rejected (${result})`);
    }
  }

  private async wait(handle: bigint, expected: number) {
    const deadline = performance.now() + 10_000;
    while (true) {
      const state = this.api.state(handle);
      if (expected === 2 && this.closing) {
        throw new Error("The desktop window is closing");
      }
      if (state === expected) return;
      if (state < 0 || (expected === 2 && state !== 1)) {
        throw new Error(`Native browser entered state ${state}`);
      }
      if (performance.now() >= deadline) {
        // Keep ownership: a timeout is not proof that CEF released the view.
        throw new Error("Native browser lifecycle operation timed out");
      }
      await pause();
    }
  }
}
