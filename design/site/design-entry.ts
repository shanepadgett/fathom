import type { TemplateResult } from "lit";

// Templates retain typed property bindings all the way into each preview.
export interface DesignEntry {
  id: string;
  name: string;
  description: string;
  category?: "Primitives" | "Composites" | "Behavior demos";
  subgroup?: string;
  examples: { name: string; markup: TemplateResult }[];
}
