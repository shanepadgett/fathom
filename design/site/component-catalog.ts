import type { DesignEntry } from "./design-entry.ts";

import { accordionExamples } from "../components/accordion.examples.ts";
import { buttonExamples } from "../components/button.examples.ts";
import { contextMenuExamples } from "../components/context-menu.examples.ts";
import { drawerExamples } from "../components/drawer.examples.ts";
import { modalExamples } from "../components/modal.examples.ts";
import { changedFilesListExamples } from "../composites/changed-files-list.examples.ts";
import { chatListItemExamples } from "../composites/chat-list-item.examples.ts";
import { chatMessageExamples } from "../composites/chat-message.examples.ts";
import { chatSearchExamples } from "../composites/chat-search.examples.ts";
import { contextUsageExamples } from "../composites/context-usage.examples.ts";
import { diffPaneExamples } from "../composites/diff-pane.examples.ts";
import { editorPaneExamples } from "../composites/editor-pane.examples.ts";
import { fileTreeExamples } from "../composites/file-tree.examples.ts";
import { messageComposerExamples } from "../composites/message-composer.examples.ts";
import { projectPickerExamples } from "../composites/project-picker.examples.ts";
import { sessionInspectorExamples } from "../composites/session-inspector.examples.ts";
import { sessionSidebarExamples } from "../composites/session-sidebar.examples.ts";
import { toolActivityExamples } from "../composites/tool-activity.examples.ts";
import { workspaceHeaderExamples } from "../composites/workspace-header.examples.ts";
import { workspaceStatusBarExamples } from "../composites/workspace-status-bar.examples.ts";
import { buttonExamples as compactButtonExamples } from "../primitives/button.examples.ts";
import { changeStatusExamples } from "../primitives/change-status.examples.ts";
import { wordmarkExamples } from "../primitives/fathom-wordmark.examples.ts";
import { meterExamples } from "../primitives/meter.examples.ts";
import { shortcutHintExamples } from "../primitives/shortcut-hint.examples.ts";
import { tabStripExamples } from "../primitives/tab-strip.examples.ts";

export const components: DesignEntry[] = [
  {
    id: "context-menu",
    name: "Context menu",
    description: "Segmented actions with an optional companion agent button.",
    category: "Primitives",
    examples: contextMenuExamples,
  },
  {
    id: "wordmark",
    name: "Wordmark",
    description: "Shared Fathom identity with bold lettering and an accent period.",
    category: "Primitives",
    examples: wordmarkExamples,
  },
  {
    id: "workspace-controls",
    name: "Compact controls",
    description:
      "Static button, icon button, selector, and tab appearances using the shared button system.",
    category: "Primitives",
    examples: [...compactButtonExamples, ...tabStripExamples],
  },
  {
    id: "status-and-usage",
    name: "Status and usage",
    description: "Git states, run indicators, token usage, and keyboard hints.",
    category: "Primitives",
    examples: [...changeStatusExamples, ...meterExamples, ...shortcutHintExamples],
  },
  {
    id: "chat-navigation",
    name: "Chat navigation",
    description: "Shared project and branch identities with compact, single-line chat titles.",
    category: "Composites",
    examples: [...sessionSidebarExamples, ...chatListItemExamples],
  },
  {
    id: "search-surfaces",
    name: "Search surfaces",
    description:
      "Static project and chat search share the surface, search line, and keyboard footer.",
    category: "Composites",
    examples: [...projectPickerExamples, ...chatSearchExamples],
  },
  {
    id: "file-navigation",
    name: "File navigation",
    description:
      "Dense file rows are shared by the tree and Changes list. Expansion is a supplied preview state.",
    category: "Composites",
    examples: [...fileTreeExamples, ...changedFilesListExamples],
  },
  {
    id: "conversation-content",
    name: "Conversation content",
    description:
      "Messages compose authored prose, tool activity, change summaries, and run status.",
    category: "Composites",
    examples: [...chatMessageExamples, ...toolActivityExamples],
  },
  {
    id: "composer",
    name: "Composer",
    description: "Floating composer surface with shared compact controls; no application actions.",
    category: "Composites",
    examples: [...messageComposerExamples],
  },
  {
    id: "editor-pane",
    name: "Editor pane",
    description: "File tabs, compact breadcrumbs, static code, and editor status.",
    category: "Composites",
    examples: [...editorPaneExamples],
  },
  {
    id: "diff-pane",
    name: "Diff pane",
    description: "Shared breadcrumb and change statistics with static diff lines.",
    category: "Composites",
    examples: [...diffPaneExamples],
  },
  {
    id: "session-inspector",
    name: "Session inspector",
    description: "Sections and metric lists for session information.",
    category: "Composites",
    examples: [...sessionInspectorExamples],
  },
  {
    id: "workspace-chrome",
    name: "Workspace chrome",
    description: "Header and footer shared across both workspace layouts.",
    category: "Composites",
    examples: [...workspaceHeaderExamples, ...workspaceStatusBarExamples, ...contextUsageExamples],
  },
  {
    id: "modal",
    category: "Behavior demos",
    name: "Modal",
    description: "A focused dialog with a lightly darkened backdrop.",
    examples: modalExamples,
  },
  {
    id: "drawer",
    category: "Behavior demos",
    name: "Drawer",
    description: "A side panel for supporting content.",
    examples: drawerExamples,
  },
  {
    id: "accordion",
    category: "Behavior demos",
    name: "Accordion",
    description: "Expandable sections. Allow one or multiple sections to stay open.",
    examples: accordionExamples,
  },
  {
    id: "button",
    category: "Primitives",
    name: "Button",
    description: "Triggers an action.",
    examples: buttonExamples,
  },
];
