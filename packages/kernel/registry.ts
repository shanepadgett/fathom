import type { Entry, Registry } from "@fathom/sdk";
import type { PluginScope } from "./scope.ts";

export class KernelRegistry<E> {
  private values = new Map<
    string,
    { entry: Entry<E>; scope: PluginScope; active: boolean }
  >();
  private watchers = new Set<(entries: Entry<E>[]) => void>();

  constructor(
    readonly id: string,
    private key?: (value: E) => string,
    private changed: () => void = () => {},
  ) {}

  entries() {
    return [...this.values.values()]
      .filter((x) => x.active)
      .map((x) => x.entry)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  private lookup(key: string) {
    const keyOf = this.key;

    if (keyOf) {
      return [...this.values.values()].find(
        (item) => item.active && keyOf(item.entry.value) === key,
      );
    }

    const item = this.values.get(key);

    return item?.active ? item : undefined;
  }

  private emit() {
    this.changed();

    for (const fn of this.watchers) {
      try {
        fn(this.entries());
      } catch {
        // Observers cannot break registry mutations.
      }
    }
  }

  contributions(owner: string) {
    return this.entries()
      .filter((e) => e.owner === owner)
      .map((e) => e.id);
  }

  view(scope: PluginScope): Registry<E> {
    return {
      id: this.id,

      add: (value, opts = {}) => {
        if (!scope.accepting) {
          throw new Error(`${scope.id} is stopping`);
        }

        const localId = opts.id ?? crypto.randomUUID();

        if (!localId || localId.includes("/")) {
          throw new Error(
            "Contribution ids must be nonempty local names without /",
          );
        }

        const id = `${scope.id}/${localId}`;

        if (this.values.has(id)) {
          throw new Error(`Duplicate contribution ${id}`);
        }

        if (this.key) {
          const keyOf = this.key;
          const key = keyOf(value);

          if (typeof key !== "string" || !key) {
            throw new Error(`Missing registry identity ${this.key}`);
          }

          if (
            [...this.values.values()].some((v) => keyOf(v.entry.value) === key)
          ) {
            throw new Error(`Duplicate ${this.id} identity: ${key}`);
          }
        }

        const item = {
          entry: { id, owner: scope.id, value, order: opts.order ?? 0 },
          scope,
          active: false,
        };

        this.values.set(id, item);
        let removed = false;

        const remove = () => {
          if (removed) {
            return;
          }

          removed = true;
          this.values.delete(id);

          if (item.active) {
            this.emit();
          }
        };

        scope.defer(remove);

        scope.stage(
          () => {
            if (!removed) {
              item.active = true;
            }
          },
          () => this.emit(),
        );

        return remove;
      },

      entries: () => this.entries(),
      get: (key) => this.lookup(key)?.entry,

      watch: (fn) => {
        this.watchers.add(fn);

        const off = () => {
          this.watchers.delete(fn);
        };

        scope.defer(off);
        fn(this.entries());

        return off;
      },

      lease: (id) => {
        const item = this.lookup(id);

        if (!scope.accepting || !item?.active || !item.scope.accepting) {
          return;
        }

        const release = item.scope.pin();

        return {
          value: item.entry.value,
          signal: item.scope.signal,
          release,
          [Symbol.dispose]: release,
        };
      },
    };
  }
}
