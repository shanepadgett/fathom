import type { Dispose } from "./scope.ts";

export interface Entry<E> {
  id: string;
  owner: string;
  order: number;
  value: E;
}

/** Holds the owner's shutdown open. Release with `using` or in `finally`. */
export interface Lease<E> {
  value: E;
  /** The owner's shutdown signal; work using this lease must honor it. */
  signal: AbortSignal;
  /** Safe to call more than once. */
  release(): void;
  [Symbol.dispose](): void;
}

export interface Registry<E> {
  readonly id: string;
  /**
   * Publish after startup commits; removed automatically with the caller's scope.
   * Local IDs must be nonempty and contain no slash. Duplicate IDs or keys throw.
   */
  add(value: E, options?: { id?: string; order?: number }): Dispose;
  /** Active entries sorted by order, then ID. Does not hold a lease. */
  entries(): Entry<E>[];
  /** Called immediately and on changes; unsubscribed when the caller stops. */
  watch(fn: (entries: Entry<E>[]) => void): Dispose;
  /** Look up by configured key, or full entry ID when no key is configured. */
  get(key: string): Entry<E> | undefined;
  /** Uses the same key as `get`; unavailable if missing or either scope is stopping. */
  lease(key: string): Lease<E> | undefined;
}

export interface RegistryToken<E> {
  kind: "registry";
  id: string;
  key?(value: E): string;
  readonly _type?: E;
}

export const defineRegistry = <E>(
  id: string,
  opts?: { key?: (value: E) => string },
): RegistryToken<E> => ({ kind: "registry", id, key: opts?.key });
