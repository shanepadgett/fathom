import type { TemplateResult } from "lit";

// Templates retain typed property bindings all the way into each preview.
export interface DesignEntry {
  id: string;
  name: string;
  description: string;
  category?: (typeof componentCategories)[number];
  examples: { name: string; markup: TemplateResult }[];
}

export const componentCategories = [
  "Primitives",
  "Messages",
  "Composer",
  "Navigation",
  "Tools and execution",
  "Editor and review",
  "Workspace",
] as const;
