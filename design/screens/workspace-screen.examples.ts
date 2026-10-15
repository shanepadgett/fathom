import type { DesignEntry } from "../site/design-entry.ts";

import { html } from "lit";

import "./workspace-screen.ts";

export const workspaceScreens: DesignEntry[] = [
  {
    id: "workspace-tabs",
    name: "Workspaces · Option A: title-bar tabs",
    description:
      "Harbor is open: four folders (api, web, contracts, read-only infra). Each open workspace is a tab in the title bar; a spinner marks tabs with running agents and a speech bubble marks one that needs input. Sessions list the folders they changed, the sidebar filter is All folders, and the inspector shows each folder's branch and edits plus the services the session is running.",
    examples: [
      {
        name: "Title-bar tabs",
        markup: html`<workspace-screen state="tabs"></workspace-screen>`,
      },
    ],
  },
  {
    id: "workspace-rail",
    name: "Workspaces · Option B: workspace rail",
    description:
      "The same Harbor session with a vertical rail instead of tabs. Monogram tiles show running-agent counts and a dot for needs-input. The sessions sidebar names the current workspace and opens its options. Scales past six or seven open workspaces; full names only appear on hover.",
    examples: [
      {
        name: "Workspace rail",
        markup: html`<workspace-screen state="rail"></workspace-screen>`,
      },
    ],
  },
  {
    id: "workspace-switcher",
    name: "Workspaces · Open workspace (⌘O)",
    description:
      "Quick switcher over the current tab. Open workspaces show their tab shortcut; closed ones show when they were last used. The lower section creates, opens a file, opens a folder, or clones.",
    examples: [
      {
        name: "Open workspace",
        markup: html`<workspace-screen state="switcher"></workspace-screen>`,
      },
    ],
  },
  {
    id: "workspace-new-session",
    name: "Workspaces · New session",
    description:
      "Starting a session inside Harbor. No project choice: the session chooses which folders it may edit and where edits go. Separate worktrees are selected, so this session can run beside the two already running.",
    examples: [
      {
        name: "New session",
        markup: html`<workspace-screen state="new-session"></workspace-screen>`,
      },
    ],
  },
  {
    id: "workspace-editor",
    name: "Workspaces · Editor with folder roots",
    description:
      "Editor focus with one tree per folder. Each root shows its branch, since branches can differ; infra is collapsed and read only.",
    examples: [
      {
        name: "Folder roots",
        markup: html`<workspace-screen state="editor"></workspace-screen>`,
      },
    ],
  },
];
