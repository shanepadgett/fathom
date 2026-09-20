import { tabStrip } from "./tab-strip.ts";

export const tabStripExamples = [
  {
    name: "Tabs",
    markup: tabStrip(
      [
        { id: "files", label: "Files" },
        {
          id: "changes",
          label: "Changes",
        },
      ],
      "files",
      "Workspace section",
    ),
  },
];
