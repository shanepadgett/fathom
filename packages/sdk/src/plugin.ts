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

export interface PluginDef {
  id: string;
  requires: Tokens;
  provides: Tokens;
  config: TSchema;
  handoff?: TSchema;
  start(
    ctx: { use: Record<string, unknown>; scope: Scope; handoff: unknown },
    config: unknown,
  ): unknown;
}

/**
 * Declare dependencies and startup behavior for the kernel.
 * Return exactly the provided services; owned registries arrive through `use`.
 * Function-valued services are factories called with the consumer's scope.
 * Register cleanup with `scope`, including resources acquired before startup fails.
 * Reload handoff is undefined when absent or rejected by the receiving schema.
 */
export function definePlugin<
  R extends Tokens = Record<never, never>,
  P extends Tokens = Record<never, never>,
  C extends TSchema = ReturnType<typeof T.Object>,
>(def: {
  id: string;
  requires?: R;
  provides?: P;
  config?: C;
  handoff?: TSchema;
  start(
    ctx: {
      use: Resolved<R> & OwnedRegistries<P>;
      scope: Scope;
      handoff: unknown;
    },
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
