import type { DesignEntry } from "../site/design-entry.ts";

import { html } from "lit";

import "./workspace-setup-screen.ts";

// A new tab and the two ways it becomes a workspace.
export const workspaceSetupScreens: DesignEntry[] = [
  {
    id: "workspace-new-tab",
    name: "Workspaces · New tab",
    description:
      "A new tab before it holds a workspace. Four ways in, with New workspace emphasized, then recent workspaces with their folders and agent state. Opening a folder alone gives a one-folder workspace that can grow later.",
    examples: [
      {
        name: "New tab",
        markup:
          html`<workspace-setup-screen state="launcher"></workspace-setup-screen>`,
      },
    ],
  },
  {
    id: "workspace-setup-folders",
    name: "Workspaces · Setup 1: folders",
    description:
      "Guided setup, step one. Name the workspace and add folders from anywhere on disk, each with a short name and edit access. The file preview on the right fills in as choices are made.",
    examples: [
      {
        name: "Folders",
        markup:
          html`<workspace-setup-screen state="folders"></workspace-setup-screen>`,
      },
    ],
  },
  {
    id: "workspace-setup-detect",
    name: "Workspaces · Setup 2: run together",
    description:
      "Fathom read the folders and proposes services, the connections between them, checks, and instruction files, each traced to the file it came from. The end-to-end check is left unchecked because it needs every service.",
    examples: [
      {
        name: "Run together",
        markup:
          html`<workspace-setup-screen state="detect"></workspace-setup-screen>`,
      },
    ],
  },
  {
    id: "workspace-setup-save",
    name: "Workspaces · Setup 3: save",
    description:
      "Choose where the workspace file lives: beside the folders, inside one repository, or only in Fathom.",
    examples: [
      {
        name: "Save",
        markup:
          html`<workspace-setup-screen state="save"></workspace-setup-screen>`,
      },
    ],
  },
  {
    id: "workspace-setup-agent",
    name: "Workspaces · Setup by conversation",
    description:
      "Alternative to the guided steps: describe the folders and the agent drafts the same file, asking only what it cannot read from the folders. The draft stays visible on the right until saved.",
    examples: [
      {
        name: "Setup by conversation",
        markup:
          html`<workspace-setup-screen state="agent"></workspace-setup-screen>`,
      },
    ],
  },
];
