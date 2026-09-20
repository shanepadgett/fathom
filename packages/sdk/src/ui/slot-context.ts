import { createContext } from "solid-js";
import type { SlotComposition } from "./slot-contract.ts";

export const SlotsContext = createContext<() => SlotComposition>();
