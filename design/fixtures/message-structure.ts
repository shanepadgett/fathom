import type { Message } from "../models/conversation.ts";

export const messageStructure: Record<"user" | "longUser" | "update" | "answer" | "followUp", Message> = {
  user: {
    author: "You",
    time: "10:42",
    blocks: [{ kind: "prose", text: "Keep the sidebar title in sync when I rename a conversation." }],
  },
  longUser: {
    collapsible: true,
    author: "You",
    time: "10:42",
    blocks: [
      { kind: "prose", text: "When I rename a conversation, the header updates but the sidebar keeps the old title until I refresh." },
      { kind: "prose", text: "Please check both the active conversation and one that’s running in the background. Renaming either should preserve the selected conversation and its messages." },
      { kind: "prose", text: "Use a longer title too: Investigating how conversation titles stay synchronized across the workspace." },
      { kind: "prose", text: "After renaming, switch to another conversation and then return. The updated title should remain visible, and the message history should stay exactly where I left it." },
      { kind: "prose", text: "Please also check an empty title, repeated renames, and a title pasted from a document with extra whitespace. Keep any validation next to the rename field so I can understand what happened." },
      { kind: "prose", text: "Finally, resize the sidebar and open the same conversation in the narrow drawer. I want the full title available even when the visible label has to truncate." },
    ],
  },
  update: {
    author: "Fathom",
    time: "10:42",
    agent: true,
    blocks: [{ kind: "prose", text: "I’ll trace how the header and sidebar read the conversation title." }],
  },
  answer: {
    author: "Fathom",
    time: "10:44",
    agent: true,
    blocks: [
      { kind: "prose", text: "The header and sidebar now read the title from the same session record. Renaming a conversation updates both immediately." },
      { kind: "prose", text: "The focused checks passed for active and background conversations. Selection stays attached to the session ID, and longer titles still truncate in the sidebar." },
    ],
  },
  followUp: {
    author: "You",
    time: "10:45",
    blocks: [{ kind: "prose", text: "Also keep the full title visible in the conversation header." }],
  },
};
