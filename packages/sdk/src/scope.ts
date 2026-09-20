import type { Static, TSchema } from "./schema.ts";

export type Dispose = () => void | Promise<void>;

export interface Scope {
  readonly id: string;
  /** Aborted after the shutdown drain period, before cleanup begins. */
  readonly signal: AbortSignal;
  /** Register cleanup in reverse order of registration. Throws while stopping. */
  defer(dispose: Dispose): void;
  /** Track work for shutdown. Honor the signal; failures are reported to the kernel. */
  task(work: (signal: AbortSignal) => Promise<void>): void;
  /** Produce schema-checked state for reload; replaces any earlier producer. */
  handoff<S extends TSchema>(schema: S, produce: () => Static<S>): void;
}
