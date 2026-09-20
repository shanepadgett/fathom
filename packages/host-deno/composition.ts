import { CompositionSchema, decode, type Static } from "@fathom/sdk";

export class CompositionStore {
  value: Static<typeof CompositionSchema> = {
    revision: 0,
    backend: {},
    ui: {},
    slots: { order: {}, hidden: [] },
  };
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private path: string) {}

  async load() {
    try {
      this.value = decode(
        CompositionSchema,
        JSON.parse(await Deno.readTextFile(this.path)),
      );

      const { order, hidden } = this.value.slots;
      this.value.slots = { order, hidden };
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        throw e;
      }
    }
  }

  async update(
    revision: number | undefined,
    patch: Partial<
      Pick<Static<typeof CompositionSchema>, "backend" | "ui" | "slots">
    >,
  ) {
    const work = this.queue.then(async () => {
      if (revision !== undefined && revision !== this.value.revision) {
        throw new Error(
          "Composition changed in another window. Refresh and retry.",
        );
      }

      const next = decode(CompositionSchema, {
        ...this.value,
        ...patch,
        revision: this.value.revision + 1,
      });

      const temp = `${this.path}.${crypto.randomUUID()}.tmp`;

      try {
        await Deno.writeTextFile(temp, JSON.stringify(next, null, 2), {
          mode: 0o600,
        });

        await Deno.rename(temp, this.path);
        this.value = next;
      } catch (error) {
        try {
          await Deno.remove(temp);
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) {
            throw new AggregateError(
              [error, e],
              "Write and temporary file cleanup failed",
            );
          }
        }

        throw error;
      }
    });

    // Keep later writes runnable; this caller still receives the original failure.
    this.queue = work.catch(() => {});
    await work;
  }
}
