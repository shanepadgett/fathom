import { buttonExamples } from "./components/button.examples.ts";
import {
  accordionExamples,
  drawerExamples,
  modalExamples,
} from "./components/motion.examples.ts";

// Local, authored markup only. Never put external data into these templates.
export interface DesignEntry {
  id: string;
  name: string;
  description: string;
  examples: { name: string; markup: string }[];
}

export const components: DesignEntry[] = [
  {
    id: "modal",
    name: "Modal",
    description: "A focused dialog with a lightly darkened backdrop.",
    examples: modalExamples,
  },
  {
    id: "drawer",
    name: "Drawer",
    description: "A side panel for supporting content.",
    examples: drawerExamples,
  },
  {
    id: "accordion",
    name: "Accordion",
    description:
      "Expandable sections. Allow one or multiple sections to stay open.",
    examples: accordionExamples,
  },
  {
    id: "button",
    name: "Button",
    description: "Triggers an action.",
    examples: buttonExamples,
  },
];

export const screens: DesignEntry[] = [];
