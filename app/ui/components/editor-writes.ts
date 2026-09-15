/** Orders editor writes per file while allowing unrelated files to persist independently. */
export class EditorWrites {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private pending = new Map<string, () => Promise<unknown>>();
  private tails = new Map<string, Promise<unknown>>();

  constructor(private failed: (error: unknown) => void) {}

  schedule(path: string, write: () => Promise<unknown>) {
    this.cancel(path);
    this.pending.set(path, write);
    this.timers.set(
      path,
      setTimeout(() => {
        this.pending.delete(path);
        this.timers.delete(path);
        void this.run(path, write).catch(this.failed);
      }, 250),
    );
  }

  cancel(path: string) {
    clearTimeout(this.timers.get(path));
    this.timers.delete(path);
    this.pending.delete(path);
  }

  run<T>(path: string, write: () => Promise<T>): Promise<T> {
    const result = (this.tails.get(path) ?? Promise.resolve()).catch(() => {})
      .then(write);
    this.tails.set(path, result);
    void result.finally(() => {
      if (this.tails.get(path) === result) this.tails.delete(path);
    }).catch(() => {});
    return result;
  }

  flush() {
    for (const [path, write] of this.pending) {
      this.cancel(path);
      void this.run(path, write).catch(this.failed);
    }
  }
}
