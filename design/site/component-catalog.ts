import type { DesignEntry } from "./design-entry.ts";

import { changeSummaryExamples } from "../composites/change-summary.examples.ts";
import { toolExecutionExamples } from "../composites/tool-execution.examples.ts";
import { accordionExamples } from "../components/accordion.examples.ts";
import { buttonExamples } from "../components/button.examples.ts";
import { contextMenuExamples } from "../components/context-menu.examples.ts";
import { drawerExamples } from "../components/drawer.examples.ts";
import { modalExamples } from "../components/modal.examples.ts";
import { changedFilesListExamples } from "../composites/changed-files-list.examples.ts";
import { chatListItemExamples } from "../composites/chat-list-item.examples.ts";
import { agentMessageExamples, chatMessageExamples, messageDeliveryExamples, messageRevisionExamples, referencedMessageExamples, userMessageExamples } from "../composites/chat-message.examples.ts";
import { messageActionsExamples } from "../composites/message-actions.examples.ts";
import { messageHeaderExamples } from "../composites/message-header.examples.ts";
import { messageBoundaryExamples, turnGroupingExamples } from "../composites/message-transcript.examples.ts";
import { chatSearchExamples } from "../composites/chat-search.examples.ts";
import { contextUsageExamples } from "../composites/context-usage.examples.ts";
import { diffPaneExamples } from "../composites/diff-pane.examples.ts";
import { editorPaneExamples } from "../composites/editor-pane.examples.ts";
import { fileTreeExamples } from "../composites/file-tree.examples.ts";
import { messageComposerExamples } from "../composites/message-composer.examples.ts";
import { projectPickerExamples } from "../composites/project-picker.examples.ts";
import { sessionInspectorExamples } from "../composites/session-inspector.examples.ts";
import { sessionSidebarExamples } from "../composites/session-sidebar.examples.ts";
import { toolSummaryExamples } from "../composites/tool-summary.examples.ts";
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
    id: "tool-execution", name: "Tool execution", category: "Composites", subgroup: "Tools and execution",
    description: "Active tool, last result, thinking, and completed batches. Expand each call to inspect arguments and resizable output. The live preview repeats.",
    examples: toolExecutionExamples,
  },
  {
    id: "change-summary", name: "Change card", category: "Composites", subgroup: "Editor and review",
    description: "Per-file changes with derived totals and an expandable file list. Review and undo are visual controls in this design reference.",
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
    subgroup: "Workspace navigation",
    examples: [...sessionSidebarExamples, ...chatListItemExamples],
  },
  {
    id: "search-surfaces",
    name: "Search surfaces",
    description:
      "Static project and chat search share the surface, search line, and keyboard footer.",
    category: "Composites",
    subgroup: "Workspace navigation",
    examples: [...projectPickerExamples, ...chatSearchExamples],
  },
  {
    id: "file-navigation",
    name: "File navigation",
    description:
      "Dense file rows are shared by the tree and Changes list. Expansion is a supplied preview state.",
    category: "Composites",
    subgroup: "Workspace navigation",
    examples: [...fileTreeExamples, ...changedFilesListExamples],
  },
  {
    id: "conversation-content",
    name: "Conversation content",
    description:
      "Messages compose authored prose, tool activity, change summaries, and run status.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: chatMessageExamples,
  },
  {
    id: "user-message",
    name: "User message",
    description: "Short and long prompts, attached context, and an attachment-only message. Static design study; actions are simulated.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: userMessageExamples,
  },
  {
    id: "agent-message",
    name: "Agent message",
    description: "Progress updates, a looping streaming response, final answers, and mixed content. Static design study; actions are simulated.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: agentMessageExamples,
  },
  {
    id: "message-identity",
    name: "Message identity",
    description: "Five shortlisted working animations. Original option numbers are preserved. Working responses omit timestamps; finished responses show them.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: messageHeaderExamples,
  },
  {
    id: "turn-grouping",
    name: "Turn grouping",
    description: "Agent messages interleaved with collapsed file-operation counts. Static design study; actions are simulated.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: turnGroupingExamples,
  },
  {
    id: "message-actions",
    name: "Message actions",
    description: "Visible action rows for user and agent messages, including unavailable actions while responding. Static design study; actions are simulated.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: messageActionsExamples,
  },
  {
    id: "message-revisions",
    name: "Message revisions",
    description: "Edited prompts, alternate answers, and an edit-and-resend surface. Static design study; actions are simulated.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: messageRevisionExamples,
  },
  {
    id: "referenced-message",
    name: "Referenced message",
    description: "Quoted excerpts with source context and an unavailable-source fallback. Static design study; actions are simulated.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: referencedMessageExamples,
  },
  {
    id: "message-delivery",
    name: "Delivery state",
    description: "Sending, queued, received, failed, and retrying messages. Static design study; actions are simulated.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: messageDeliveryExamples,
  },
  {
    id: "message-boundaries",
    name: "Message boundaries",
    description: "Consecutive messages, unread dividers, and resumed history. Static design study; actions are simulated.",
    category: "Composites",
    subgroup: "Message structure and identity",
    examples: messageBoundaryExamples,
  },
  {
    id: "tool-activity",
    name: "Tool activity",
    description: "Completed tool summaries with files and research detail.",
    category: "Composites",
    subgroup: "Tools and execution",
    examples: [...toolSummaryExamples, ...toolActivityExamples],
  },
  {
    id: "composer",
    name: "Composer",
    description: "Floating composer surface with shared compact controls; no application actions.",
    category: "Composites",
    subgroup: "Composer",
    examples: [...messageComposerExamples],
  },
  {
    id: "editor-pane",
    name: "Editor pane",
    description: "File tabs, compact breadcrumbs, static code, and editor status.",
    category: "Composites",
    subgroup: "Editor and review",
    examples: [...editorPaneExamples],
  },
  {
    id: "diff-pane",
    name: "Diff pane",
    description: "Shared breadcrumb and change statistics with static diff lines.",
    category: "Composites",
    subgroup: "Editor and review",
    examples: [...diffPaneExamples],
  },
  {
    id: "session-inspector",
    name: "Session inspector",
    description: "Sections and metric lists for session information.",
    category: "Composites",
    subgroup: "Workspace status",
    examples: [...sessionInspectorExamples],
  },
  {
    id: "workspace-chrome",
    name: "Workspace chrome",
    description: "Header and footer shared across both workspace layouts.",
    category: "Composites",
    subgroup: "Workspace status",
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
