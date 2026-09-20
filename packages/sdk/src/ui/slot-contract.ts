import type { Component } from "solid-js";
import { defineRegistry, type RegistryToken } from "../registry.ts";
import { defineService, type ServiceToken } from "../service.ts";
import type { Static } from "../schema.ts";
import type { CompositionSchema } from "../composition.ts";

export type SlotComposition = Static<typeof CompositionSchema>["slots"];

export const Slots: ServiceToken<() => SlotComposition> =
  defineService("fathom.slots");

export interface Contribution<C extends Record<string, unknown>> {
  component: Component<C>;
}

export const defineSlot = <C extends Record<string, unknown>>(
  id: string,
): RegistryToken<Contribution<C>> => defineRegistry<Contribution<C>>(id);
