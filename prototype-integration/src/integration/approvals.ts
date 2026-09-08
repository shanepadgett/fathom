export class Approvals {
  readonly pending = new Map<
    string,
    { id: string; description: string; settle(allow: boolean): void }
  >();
  request(description: string, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const abort = () => settle(false);
      const settle = (allow: boolean) => {
        this.pending.delete(id);
        signal.removeEventListener("abort", abort);
        if (allow) resolve();
        else reject(new Error("Execution denied or cancelled"));
      };
      this.pending.set(id, { id, description, settle });
      signal.addEventListener("abort", abort, { once: true });
    });
  }
  list() {
    return [...this.pending.values()].map(({ id, description }) => ({
      id,
      description,
    }));
  }
  decide(id: string, allow: boolean) {
    const item = this.pending.get(id);
    if (!item) throw new Error("Approval no longer pending");
    item.settle(allow);
  }
  dispose() {
    for (const item of this.pending.values()) item.settle(false);
  }
}
