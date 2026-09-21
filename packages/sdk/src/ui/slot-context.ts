import { createContext, type Context } from "solid-js";
import type { SlotComposition } from "./slot-contract.ts";

export const SlotsContext: Context<(() => SlotComposition) | undefined> =
  createContext<() => SlotComposition>();
