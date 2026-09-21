import { type Static, T, type TSchema } from "./schema.ts";
import type { Scope } from "./scope.ts";
import type { ServiceToken } from "./service.ts";
import type { Registry, RegistryToken } from "./registry.ts";

export type Token = ServiceToken<unknown> | RegistryToken<unknown>;
export type Tokens = Record<string, Token>;

export type Resolved<T extends Tokens> = {
  [K in keyof T]: T[K] extends ServiceToken<infer V>
    ? V
    : T[K] extends RegistryToken<infer E>
      ? Registry<E>
      : never;
};

export type Services<T extends Tokens> = {
  [
    K in keyof T as T[K] extends ServiceToken<unknown> ? K : never
  ]: T[K] extends ServiceToken<infer V> ? V | ((scope: Scope) => V) : never;
};

export type OwnedRegistries<T extends Tokens> = {
  [
    K in keyof T as T[K] extends RegistryToken<unknown> ? K : never
  ]: T[K] extends RegistryToken<infer E> ? Registry<E> : never;
};

/** `scope` and `handoff` are always present, so dependencies cannot use those keys. */
export type ReservedKeys = "scope" | "handoff";

export type StartContext<R extends Tokens, P extends Tokens> = Resolved<R> &
  OwnedRegistries<P> & {
    scope: Scope;
    /** Reload state from the previous generation; undefined when absent or rejected. */
    handoff: unknown;
  };

export interface PluginDef {
  id: string;
  requires: Tokens;
  provides: Tokens;
  config: TSchema;
  handoff?: TSchema;
  start(
    ctx: Record<string, unknown> & { scope: Scope; handoff: unknown },
    config: unknown,
  ): unknown;
}

/**
 * Declare dependencies and startup behavior for the kernel.
 * Each `requires` key and each owned registry arrives on the start context under
 * its own name, beside `scope` and `handoff`. Return exactly the provided
 * services. Function-valued services are factories called with the consumer's
 * scope. Register cleanup with `scope`, including resources acquired before
 * startup fails.
 */
export function definePlugin<
  R extends Tokens = Record<never, never>,
  P extends Tokens = Record<never, never>,
  C extends TSchema = ReturnType<typeof T.Object>,
>(def: {
  id: string;
  requires?: { [K in keyof R]: K extends ReservedKeys ? never : R[K] };
  provides?: { [K in keyof P]: K extends ReservedKeys ? never : P[K] };
  config?: C;
  handoff?: TSchema;
  start(
    ctx: StartContext<R, P>,
    config: Static<C>,
  ): keyof Services<P> extends never
    ? void | Promise<void>
    : Services<P> | Promise<Services<P>>;
}): PluginDef {
  // Erase plugin-specific generics for storage; the kernel resolves tokens and
  // validates config before calling start with the corresponding values.
  return {
    requires: {},
    provides: {},
    config: T.Object({}),
    ...def,
  } as unknown as PluginDef;
}
