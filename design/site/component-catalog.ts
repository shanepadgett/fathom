import { metricListExamples } from "../primitives/metric-list.examples.ts";
import { diffPreviewExamples } from "../components/editor/diff-preview.examples.ts";
import { codePreviewExamples } from "../components/editor/code-preview.examples.ts";
import { chipExamples } from "../primitives/chip.examples.ts";
import { messageAttachmentsExamples } from "../components/messages/message-attachments.examples.ts";
import type { DesignEntry } from "./design-entry.ts";

import { componentCategories } from "./design-entry.ts";

import { changeSummaryExamples } from "../components/editor/change-summary.examples.ts";
import { toolExecutionExamples } from "../components/tools/tool-execution.examples.ts";
import { accordionExamples } from "../primitives/accordion.examples.ts";
import { buttonExamples } from "../primitives/button.examples.ts";
import { contextMenuExamples } from "../primitives/context-menu.examples.ts";
import { drawerExamples } from "../primitives/drawer.examples.ts";
import { modalExamples } from "../primitives/modal.examples.ts";
import { changedFilesListExamples } from "../components/editor/changed-files-list.examples.ts";
import { chatListItemExamples } from "../components/navigation/chat-list-item.examples.ts";
import {
  agentMessageExamples,
  chatMessageExamples,
  messageDeliveryExamples,
  messageRevisionExamples,
  referencedMessageExamples,
  userMessageExamples,
} from "../components/messages/chat-message.examples.ts";
import { messageActionsExamples } from "../components/messages/message-actions.examples.ts";
import { messageHeaderExamples } from "../components/messages/message-header.examples.ts";
import {
  messageBoundaryExamples,
  turnGroupingExamples,
} from "../components/messages/message-transcript.examples.ts";
import { chatSearchExamples } from "../components/navigation/chat-search.examples.ts";
import { contextUsageExamples } from "../components/workspace/context-usage.examples.ts";
import { diffPaneExamples } from "../components/editor/diff-pane.examples.ts";
import { editorPaneExamples } from "../components/editor/editor-pane.examples.ts";
import { fileTreeExamples } from "../components/navigation/file-tree.examples.ts";
import { messageComposerExamples } from "../components/composer/message-composer.examples.ts";
import { projectPickerExamples } from "../components/navigation/project-picker.examples.ts";
import { sessionInspectorExamples } from "../components/workspace/session-inspector.examples.ts";
import { sessionSidebarExamples } from "../components/navigation/session-sidebar.examples.ts";
import { toolSummaryExamples } from "../components/tools/tool-summary.examples.ts";
import { toolActivityExamples } from "../components/tools/tool-activity.examples.ts";
import { workspaceHeaderExamples } from "../components/workspace/workspace-header.examples.ts";
import { workspaceStatusBarExamples } from "../components/workspace/workspace-status-bar.examples.ts";
import { buttonExamples as compactButtonExamples } from "../primitives/compact-controls.examples.ts";
import { changeStatusExamples } from "../components/editor/change-status.examples.ts";
import { wordmarkExamples } from "../components/workspace/fathom-wordmark.examples.ts";
import { meterExamples } from "../primitives/meter.examples.ts";
import { shortcutHintExamples } from "../primitives/shortcut-hint.examples.ts";
import { tabStripExamples } from "../primitives/tab-strip.examples.ts";

const entries: DesignEntry[] = [
  {
    id: "meter",
    name: "Meter",
    category: "Primitives",
    description: "A labeled value within a range.",
    examples: meterExamples,
  },
  {
    id: "shortcut-hint",
    name: "Shortcut hint",
    category: "Primitives",
    description: "Keyboard keys and their action.",
    examples: shortcutHintExamples,
  },
  {
    id: "metric-list",
    name: "Metric list",
    category: "Primitives",
    description: "Reusable label and value pairs.",
    examples: metricListExamples,
  },
  {
    id: "diff-preview",
    name: "Diff preview",
    category: "Editor and review",
    description: "Standalone added, removed, and context lines.",
    examples: diffPreviewExamples,
  },
  {
    id: "code-preview",
    name: "Code preview",
    category: "Editor and review",
    description: "Standalone numbered and highlighted code.",
    examples: codePreviewExamples,
  },
  {
    id: "chip",
    name: "Chip",
    category: "Primitives",
    description: "Compact non-interactive label.",
    examples: chipExamples,
  },
  {
    id: "message-attachments",
    name: "Message attachments",
    category: "Messages",
    description:
      "Image previews, file chips, and annotation counts shared by message surfaces.",
    examples: messageAttachmentsExamples,
  },
  {
    id: "tabs",
    name: "Tabs",
    category: "Primitives",
    description: "Standalone segmented navigation control.",
    examples: tabStripExamples,
  },
  {
    id: "tool-execution",
    name: "Tool execution",
    category: "Tools and execution",
    description:
      "Active tool, last result, thinking, and completed batches. Expand each call to inspect arguments and resizable output. The live preview repeats.",
    examples: toolExecutionExamples,
  },
  {
    id: "change-summary",
    name: "Change card",
    category: "Editor and review",
    description:
      "Per-file changes with derived totals and an expandable file list. Review and undo are visual controls in this design reference.",
    examples: changeSummaryExamples,
  },
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
    description:
      "Shared Fathom identity with bold lettering and an accent period.",
    category: "Workspace",
    examples: wordmarkExamples,
  },
  {
    id: "workspace-controls",
    name: "Compact controls",
    description:
      "Selectors composed from the shared button and icon primitives alongside compact controls.",
    category: "Primitives",
    examples: compactButtonExamples,
  },
  {
    id: "status-and-usage",
    name: "Change status",
    description: "Git file states and added or removed line counts.",
    category: "Editor and review",
    examples: changeStatusExamples,
  },
  {
    id: "chat-navigation",
    name: "Chat navigation",
    description:
      "Shared project and branch identities with compact, single-line chat titles.",
    category: "Navigation",
    examples: [...sessionSidebarExamples, ...chatListItemExamples],
  },
  {
    id: "search-surfaces",
    name: "Search surfaces",
    description:
      "Static project and chat search share the surface, search line, and keyboard footer.",
    category: "Navigation",
    examples: [...projectPickerExamples, ...chatSearchExamples],
  },
  {
    id: "file-navigation",
    name: "File navigation",
    description:
      "Dense file rows are shared by the tree and Changes list. Expansion is a supplied preview state.",
    category: "Navigation",
    examples: [...fileTreeExamples, ...changedFilesListExamples],
  },
  {
    id: "conversation-content",
    name: "Conversation content",
    description:
      "Messages compose authored prose, tool activity, change summaries, and run status.",
    category: "Messages",
    examples: chatMessageExamples,
  },
  {
    id: "user-message",
    name: "User message",
    description:
      "Short and long prompts, attached context, and an attachment-only message. Static design study; actions are simulated.",
    category: "Messages",
    examples: userMessageExamples,
  },
  {
    id: "agent-message",
    name: "Agent message",
    description:
      "Progress updates, a looping streaming response, final answers, and mixed content. Static design study; actions are simulated.",
    category: "Messages",
    examples: agentMessageExamples,
  },
  {
    id: "message-identity",
    name: "Message identity",
    description:
      "Five shortlisted working animations. Original option numbers are preserved. Working responses omit timestamps; finished responses show them.",
    category: "Messages",
    examples: messageHeaderExamples,
  },
  {
    id: "turn-grouping",
    name: "Turn grouping",
    description:
      "Agent messages interleaved with collapsed file-operation counts. Static design study; actions are simulated.",
    category: "Messages",
    examples: turnGroupingExamples,
  },
  {
    id: "message-actions",
    name: "Message actions",
    description:
      "Visible action rows for user and agent messages, including unavailable actions while responding. Static design study; actions are simulated.",
    category: "Messages",
    examples: messageActionsExamples,
  },
  {
    id: "message-revisions",
    name: "Message revisions",
    description:
      "Edited prompts, alternate answers, and an edit-and-resend surface. Static design study; actions are simulated.",
    category: "Messages",
    examples: messageRevisionExamples,
  },
  {
    id: "referenced-message",
    name: "Referenced message",
    description:
      "Quoted excerpts with source context and an unavailable-source fallback. Static design study; actions are simulated.",
    category: "Messages",
    examples: referencedMessageExamples,
  },
  {
    id: "message-delivery",
    name: "Delivery state",
    description:
      "Sending, queued, received, failed, and retrying messages. Static design study; actions are simulated.",
    category: "Messages",
    examples: messageDeliveryExamples,
  },
  {
    id: "message-boundaries",
    name: "Message boundaries",
    description:
      "Consecutive messages, unread dividers, and resumed history. Static design study; actions are simulated.",
    category: "Messages",
    examples: messageBoundaryExamples,
  },
  {
    id: "tool-activity",
    name: "Tool activity",
    description: "Completed tool summaries with files and research detail.",
    category: "Tools and execution",
    examples: [...toolSummaryExamples, ...toolActivityExamples],
  },
  {
    id: "composer",
    name: "Composer",
    description:
      "Floating composer surface with shared compact controls; no application actions.",
    category: "Composer",
    examples: [...messageComposerExamples],
  },
  {
    id: "editor-pane",
    name: "Editor pane",
    description:
      "File tabs, compact breadcrumbs, static code, and editor status.",
    category: "Editor and review",
    examples: [...editorPaneExamples],
  },
  {
    id: "diff-pane",
    name: "Diff pane",
    description:
      "Shared breadcrumb and change statistics with static diff lines.",
    category: "Editor and review",
    examples: [...diffPaneExamples],
  },
  {
    id: "session-inspector",
    name: "Session inspector",
    description: "Sections and metric lists for session information.",
    category: "Workspace",
    examples: [...sessionInspectorExamples],
  },
  {
    id: "workspace-chrome",
    name: "Workspace chrome",
    description: "Header and footer shared across both workspace layouts.",
    category: "Workspace",
    examples: [
      ...workspaceHeaderExamples,
      ...workspaceStatusBarExamples,
      ...contextUsageExamples,
    ],
  },
  {
    id: "modal",
    category: "Primitives",
    name: "Modal",
    description: "A focused dialog with a lightly darkened backdrop.",
    examples: modalExamples,
  },
  {
    id: "drawer",
    category: "Primitives",
    name: "Drawer",
    description: "A side panel for supporting content.",
    examples: drawerExamples,
  },
  {
    id: "accordion",
    category: "Primitives",
    name: "Accordion",
    description:
      "Expandable sections. Allow one or multiple sections to stay open.",
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

export const components = componentCategories.flatMap((category) => {
  const group = entries.filter((entry) => entry.category === category);
  return category === "Primitives"
    ? group.sort((a, b) => a.name.localeCompare(b.name))
    : group;
});
