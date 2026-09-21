import type { Loader } from "./loader.ts";
import type { PluginRecord } from "./plugin-record.ts";
import { assertPluginDefinition } from "./definition.ts";
import { orderPlugins, affectedPlugins } from "./dependencies.ts";
import { describeGraph } from "./graph.ts";
import {
  type Change,
  decode,
  type Graph,
  type OperationStatus,
  type PluginStatus,
  type Registry,
  type RegistryToken,
  type Token,
} from "@fathom/sdk";
import {
  PluginScope,
  DEFAULT_DRAIN_TIMEOUT_MS,
  DEFAULT_CLEANUP_TIMEOUT_MS,
} from "./scope.ts";
import { KernelRegistry } from "./registry.ts";

const OPERATION_HISTORY_PRUNE_THRESHOLD = 100;
const COMPLETED_OPERATION_HISTORY_LIMIT = 80;

export class Kernel {
  private records = new Map<string, PluginRecord>();
  private services = new Map<string, { owner: string; value: unknown }>();
  private registries = new Map<
    string,
    { owner: string; registry: KernelRegistry<unknown> }
  >();

  private listeners = new Set<(s: PluginStatus[]) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private ops: OperationStatus[] = [];
  private closed = false;
  private hostScope = new PluginScope("host", () => {});

  constructor(
    readonly host: "backend" | "ui",
    private loader?: Loader,
    private persist?: (statuses: PluginStatus[]) => Promise<void>,
  ) {
    this.hostScope.commit();
  }

  provide<V>(
    token: import("@fathom/sdk").ServiceToken<V>,
    value: V | ((scope: PluginScope) => V),
  ) {
    if (this.services.has(token.id) || this.registries.has(token.id)) {
      throw new Error(`Duplicate host capability ${token.id}`);
    }

    this.services.set(token.id, { owner: "host", value });
  }

  provideRegistry<E>(token: RegistryToken<E>): Registry<E> {
    if (this.services.has(token.id) || this.registries.has(token.id)) {
      throw new Error(`Duplicate host capability ${token.id}`);
    }

    const registry = new KernelRegistry<E>(token.id, token.key, () =>
      this.emit(),
    );

    this.registries.set(token.id, {
      owner: "host",
      registry: registry as KernelRegistry<unknown>,
    });

    return registry.view(this.hostScope);
  }

  registry<E>(token: RegistryToken<E>, scope: PluginScope): Registry<E> {
    const value = this.registries.get(token.id);

    if (!value) {
      throw new Error(`Unknown host registry ${token.id}`);
    }

    return (value.registry as KernelRegistry<E>).view(scope);
  }

  async setHostService(token: Token, value: unknown | undefined) {
    const work = this.queue.then(async () => {
      if (this.closed) {
        return;
      }

      const previous = this.services.get(token.id);

      if (previous && previous.owner !== "backend") {
        throw new Error(`Cannot replace local service ${token.id}`);
      }

      const affected = this.affectedTokens(new Set([token.id]));
      await this.stopAll(affected);

      if (value === undefined) {
        this.services.delete(token.id);
      } else {
        this.services.set(token.id, { owner: "backend", value });
      }

      await this.startAll();
      this.emit();
    });

    this.queue = work.catch(() => {});
    await work;
  }

  add(intent: {
    id: string;
    source: string;
    config?: unknown;
    enabled?: boolean;
  }) {
    const { id, source, config = {}, enabled = true } = intent;

    if (!/^[-a-zA-Z0-9_.]+$/.test(id)) {
      throw new Error("Invalid plugin id");
    }

    if (this.records.has(id)) {
      throw new Error(`Duplicate plugin ${id}`);
    }

    this.records.set(id, {
      status: {
        id,
        host: this.host,
        desired: { enabled, source, config },
        actual: { state: "stopped", gen: 0 },
      },
    });
  }

  private async load(record: PluginRecord) {
    if (!this.loader) {
      throw new Error("Plugin loader unavailable");
    }

    const def = (
      await this.loader.load(
        record.status.desired.source,
        record.status.actual.gen + 1,
      )
    ).default;

    assertPluginDefinition(def);

    if (def.id !== record.status.id) {
      throw new Error("Plugin id changed");
    }

    return def;
  }

  private async retain() {
    await this.loader?.retain?.(
      [...this.records.values()].flatMap((record) =>
        record.def ? [record.def] : [],
      ),
    );
  }

  private ordered() {
    return orderPlugins(
      this.records.values(),
      (id) =>
        this.services.get(id)?.owner === "host" ||
        this.registries.get(id)?.owner === "host",
    );
  }

  async start() {
    await this.startAll();
    await this.retain();
  }

  private async startAll() {
    for (const record of this.records.values()) {
      if (
        record.def ||
        !record.status.desired.enabled ||
        record.status.actual.state === "failed"
      ) {
        continue;
      }

      try {
        record.def = await this.load(record);
      } catch (error) {
        record.status.actual = {
          state: "failed",
          gen: record.status.actual.gen + 1,
          lastError: String(error),
        };
      }
    }

    for (const record of this.ordered()) {
      if (
        !record.def ||
        !record.status.desired.enabled ||
        record.scope ||
        record.status.actual.restartRequired ||
        record.status.actual.state === "failed"
      ) {
        continue;
      }

      const waiting = Object.values(record.def?.requires ?? {})
        .filter(
          (t) =>
            !(t.kind === "service" ? this.services : this.registries).has(t.id),
        )
        .map((t) => t.id);

      if (waiting.length) {
        record.status.actual.state = "blocked";
        record.status.actual.waitingOn = waiting;
        continue;
      }

      record.status.actual = {
        state: "starting",
        gen: record.status.actual.gen + 1,
      };

      this.emit();

      const scope = new PluginScope(record.status.id, (error) => {
        record.status.actual.lastError = String(error);
        this.emit();
      });

      record.scope = scope;

      try {
        const config = decode(record.def.config, record.status.desired.config);

        if (this.loader?.activate) {
          scope.defer(
            await this.loader.activate(
              record.status.desired.source,
              record.def,
            ),
          );
        }

        const dependencies: Record<string, unknown> = {};

        for (const [key, t] of Object.entries(record.def.requires)) {
          dependencies[key] =
            t.kind === "service"
              ? this.resolveService(t.id, scope)
              : this.registries.get(t.id)!.registry.view(scope);
        }

        for (const [key, t] of Object.entries(record.def.provides)) {
          if (this.services.has(t.id) || this.registries.has(t.id)) {
            throw new Error(`Duplicate provider for ${t.id}`);
          }

          if (t.kind === "registry") {
            const registry = new KernelRegistry(t.id, t.key, () => this.emit());
            this.registries.set(t.id, { owner: record.status.id, registry });
            dependencies[key] = registry.view(scope);
          }
        }

        let handoff: unknown;

        try {
          handoff = record.def.handoff
            ? decode(record.def.handoff, record.handoff)
            : undefined;
        } catch {
          handoff = undefined;
        }

        const result = await record.def.start(
          { ...dependencies, scope, handoff },
          config,
        );

        if (
          result != null &&
          (typeof result !== "object" || Array.isArray(result))
        ) {
          throw new Error("start must return an object of provided services");
        }

        // Keep service identities and functions intact; schema decoding clones data.
        const services: Record<string, unknown> = Object.fromEntries(
          Object.entries(result ?? {}),
        );

        const keys = Object.entries(record.def.provides).filter(
          ([, t]) => t.kind === "service",
        );

        if (
          Object.keys(services).sort().join() !==
          keys
            .map(([k]) => k)
            .sort()
            .join()
        ) {
          throw new Error("start must return exactly its provided services");
        }

        for (const [key, t] of keys) {
          if (services[key] === undefined) {
            throw new Error(`Missing service ${key}`);
          }

          this.services.set(t.id, {
            owner: record.status.id,
            value: services[key],
          });
        }

        scope.commit();
        record.status.actual.state = "ready";
      } catch (error) {
        try {
          await this.stop(record, 0);
        } catch {
          // stop records restartRequired and retains ownership.
        }

        record.status.actual.state = "failed";
        record.status.actual.lastError = String(error);
      }
    }

    this.emit();
  }

  private resolveService(id: string, scope: PluginScope) {
    const value = this.services.get(id)!.value;

    return typeof value === "function" ? value(scope) : value;
  }

  private async stop(record: PluginRecord, drainMs = DEFAULT_DRAIN_TIMEOUT_MS) {
    const scope = record.scope;

    if (!scope) {
      record.status.actual.state = "stopped";
      record.status.actual.waitingOn = undefined;

      return;
    }

    record.status.actual.state = "stopping";
    this.emit();

    try {
      await scope.stop(drainMs, DEFAULT_CLEANUP_TIMEOUT_MS, () => {
        try {
          record.handoff = scope.snapshot();
        } catch {
          record.handoff = undefined;
        }
      });
    } catch (error) {
      record.status.actual.restartRequired = true;
      record.status.actual.state = "failed";
      record.status.actual.lastError = String(error);
      this.emit();
      throw error;
    }

    for (const [id, s] of this.services) {
      if (s.owner === record.status.id) {
        this.services.delete(id);
      }
    }

    for (const [id, s] of this.registries) {
      if (s.owner === record.status.id) {
        this.registries.delete(id);
      }
    }

    record.scope = undefined;
    record.status.actual.state = "stopped";
    record.status.actual.waitingOn = undefined;
  }

  private async stopAll(
    records: PluginRecord[],
    drainMs = DEFAULT_DRAIN_TIMEOUT_MS,
  ) {
    for (const record of records) {
      if (record.scope) {
        record.scope.accepting = false;
      }
    }

    for (const record of [...records].reverse()) {
      await this.stop(record, drainMs);
    }
  }

  private affectedTokens(tokens: Set<string>, ids = new Set<string>()) {
    return affectedPlugins(this.ordered(), tokens, ids);
  }

  private affected(id: string) {
    return this.affectedTokens(
      new Set(
        Object.values(this.records.get(id)!.def?.provides ?? {}).map(
          (t) => t.id,
        ),
      ),
      new Set([id]),
    );
  }

  submit(change: Change): string {
    if (this.closed) {
      throw new Error("Kernel is stopping");
    }

    if (!this.records.has(change.id)) {
      throw new Error(`Unknown plugin ${change.id}`);
    }

    const op: OperationStatus = {
      id: crypto.randomUUID(),
      plugin: change.id,
      host: this.host,
      action: change.action,
      state: "queued",
    };

    this.ops.push(op);

    if (this.ops.length > OPERATION_HISTORY_PRUNE_THRESHOLD) {
      this.ops = this.ops
        .filter((o) => o.state === "queued" || o.state === "running")
        .concat(
          this.ops
            .filter((o) => o.state !== "queued" && o.state !== "running")
            .slice(-COMPLETED_OPERATION_HISTORY_LIMIT),
        );
    }

    this.emit();

    this.queue = this.queue.then(async () => {
      op.state = "running";
      this.emit();

      try {
        await this.change(change);
        op.state = "succeeded";
      } catch (error) {
        op.state = "failed";
        op.error = String(error);

        const record = this.records.get(change.id)!;
        record.status.actual.lastError = String(error);
      } finally {
        if (
          ![...this.records.values()].some(
            (record) => record.status.actual.restartRequired,
          )
        ) {
          try {
            await this.retain();
          } catch (error) {
            this.records.get(change.id)!.status.actual.lastError =
              `Artifact cleanup failed: ${String(error)}`;
          }
        }

        this.emit();
      }
    });

    return op.id;
  }

  async settled() {
    await this.queue;
  }

  private async change(change: Change) {
    const record = this.records.get(change.id)!;

    if (record.status.actual.restartRequired) {
      throw new Error("Restart required before changing this plugin");
    }

    let candidate = record.def;

    if (
      change.action === "reload" ||
      (!candidate && change.action !== "disable")
    ) {
      candidate = await this.load(record);
    }

    const config =
      change.action === "disable"
        ? record.status.desired.config
        : decode(
            candidate!.config,
            change.action === "config"
              ? change.config
              : record.status.desired.config,
          );

    const previous = {
      def: record.def,
      desired: structuredClone(record.status.desired),
    };

    let enabled = record.status.desired.enabled;

    if (change.action === "enable") {
      enabled = true;
    } else if (change.action === "disable") {
      enabled = false;
    }

    const affected = new Set(this.affected(change.id));

    try {
      record.def = candidate;
      record.status.desired.enabled = enabled;

      for (const item of this.affected(change.id)) {
        affected.add(item);
      }
    } finally {
      record.def = previous.def;
      record.status.desired = previous.desired;
    }

    const oldOrder = this.ordered().filter((x) => affected.has(x));
    await this.stopAll(oldOrder);

    const previousHandoffs = new Map(
      [...affected].map((item) => [item, item.handoff]),
    );

    record.def = candidate;
    record.status.desired = { ...previous.desired, enabled, config };

    try {
      await this.startAll();

      const failed = [...affected].find(
        (x) => x.status.actual.state === "failed",
      );

      if (failed) {
        throw new Error(
          failed.status.actual.lastError ?? "Plugin activation failed",
        );
      }

      await this.persist?.(this.plugins());
    } catch (error) {
      if ([...affected].some((x) => x.status.actual.restartRequired)) {
        throw error;
      }

      await this.stopAll(
        this.ordered().filter((x) => affected.has(x)),
        0,
      );

      record.def = previous.def;
      record.status.desired = previous.desired;

      for (const [item, handoff] of previousHandoffs) {
        item.handoff = handoff;
      }

      await this.startAll();
      throw new Error(`Change rolled back: ${String(error)}`);
    }
  }

  plugins(): PluginStatus[] {
    // Schemas are plain JSON apart from TypeBox's symbol keys, which cloning drops.
    return structuredClone(
      [...this.records.values()].map((record) => ({
        ...record.status,
        ...(record.def ? { configSchema: record.def.config } : {}),
      })),
    );
  }

  operations(): OperationStatus[] {
    return structuredClone(this.ops);
  }

  graph(): Graph {
    return describeGraph(
      this.records.values(),
      this.host,
      this.services,
      this.registries,
    );
  }

  watch(fn: (s: PluginStatus[]) => void): () => void {
    this.listeners.add(fn);
    fn(this.plugins());

    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const status = this.plugins();

    for (const fn of this.listeners) {
      try {
        fn(status);
      } catch {
        // Observers cannot break lifecycle changes.
      }
    }
  }

  async shutdown() {
    this.closed = true;
    await this.queue;
    await this.stopAll(this.ordered(), 0);
    await this.hostScope.stop(0);
    this.emit();
  }
}
