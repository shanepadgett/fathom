import type { Context as Cordis } from "cordis";

import { Context } from "cordis";

/** Named services. Plugins merge their own key in. Missing from `inject` means missing on `ctx`. */
export interface Services {}

export type PluginContext<I extends keyof Services> = Cordis & Pick<Services, I>;

type InjectOf<P> = P extends { inject?: readonly (infer I)[] }
  ? I extends keyof Services
    ? I
    : never
  : never;

type ProvideOf<P> = P extends { provide?: infer R }
  ? R extends keyof Services
    ? R
    : never
  : never;

type ConfigOf<P> = P extends new (...args: infer A) => unknown
  ? A extends [unknown, infer C]
    ? C
    : void
  : P extends { apply: (...args: infer A) => unknown }
    ? A extends [unknown, infer C]
      ? C
      : void
    : void;

type ConfigArgs<P> = [ConfigOf<P>] extends [void]
  ? []
  : undefined extends ConfigOf<P>
    ? [config?: ConfigOf<P>]
    : [config: ConfigOf<P>];

type Unmet<K extends PropertyKey> = { readonly missing: K };

export function definePlugin<const I extends keyof Services = never, C = void>(spec: {
  name: string;
  inject?: readonly I[];
  apply: (ctx: PluginContext<I>, config: C) => void;
}): { name: string; inject: I[]; apply: (ctx: Cordis, config: C) => void } {
  return {
    name: spec.name,
    inject: [...(spec.inject ?? [])],
    apply: (ctx: Cordis, config: C) => spec.apply(ctx as PluginContext<I>, config),
  };
}

/** Queue plugins. Each `use` adds what that plugin provides. Inject must already be present. */
export class Composer<Have extends keyof Services = never> {
  #ctx = new Context();
  #queue: { plugin: unknown; config?: unknown }[] = [];

  use<P extends object>(
    plugin: P,
    ...config: ConfigArgs<P>
  ): Exclude<InjectOf<P>, Have> extends never
    ? Composer<Have | ProvideOf<P>>
    : Unmet<Exclude<InjectOf<P>, Have>> {
    this.#queue.push({ plugin, config: config[0] });
    return this as never;
  }

  async start() {
    for (const row of this.#queue) {
      await this.#ctx.plugin(row.plugin as never, row.config as never);
    }
    return this.#ctx;
  }
}

export function compose() {
  return new Composer();
}
