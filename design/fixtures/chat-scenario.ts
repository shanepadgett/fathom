import type { Message } from "../models/conversation.ts";
import type { InspectorData } from "../models/inspector.ts";
import type { Chat } from "../models/session.ts";

import { contextUsage } from "./context-usage.ts";

const chats: Chat[] = [
  {
    id: "gardens",
    title: "How community gardens get started",
    time: "Now",
    status: "Researching",
    activity: "running",
  },
  {
    id: "libraries",
    title: "What makes a good public library?",
    time: "2m",
    activity: "completed",
    unread: true,
  },
  {
    id: "walking",
    title: "Ideas for a neighborhood walking group",
    time: "5m",
    activity: "attention",
    unread: true,
  },
  {
    id: "books",
    title: "Books for a rainy weekend",
    time: "1d",
    activity: "completed",
    unread: false,
  },
];

const messages: Message[] = [
  {
    author: "You",
    time: "10:42",
    blocks: [
      {
        kind: "prose",
        text:
          "How do people start a community garden? Look for practical guides and help me figure out what to ask at our first neighborhood meeting.",
      },
    ],
  },
  {
    author: "Fathom",
    time: "10:42",
    agent: true,
    blocks: [
      {
        kind: "prose",
        text:
          "I’ll look for community garden guides, then ask a web research subagent to compare how they handle land access, shared costs, and ongoing upkeep.",
      },
      {
        kind: "research",
        label: "Searched the web",
        duration: "1.4s",
        detail:
          "Community garden startup guides · land access · organizing volunteers",
      },
      {
        kind: "research",
        label: "Web research subagent completed",
        duration: "18s",
        detail:
          "Compared garden planning guides from university extension programs and municipal gardening programs.",
      },
      {
        kind: "prose",
        text:
          "For the first meeting, focus on who wants to participate, what space might be available, and who can help maintain it. A shared garden needs an agreement about the work as much as an agreement about the space.",
      },
      {
        kind: "prose",
        text:
          "Useful questions to bring: Who can help each week? Who can contact the landowner? Is water available? Would people prefer individual plots or shared beds? What costs can the group cover?",
      },
    ],
  },
  {
    author: "You",
    time: "10:44",
    blocks: [
      {
        kind: "prose",
        text:
          "We don’t have a site yet. Can you look more closely at what to ask a potential landowner before we commit?",
      },
    ],
  },
  {
    author: "Fathom",
    time: "10:44",
    agent: true,
    blocks: [
      {
        kind: "prose",
        text:
          "I’ll research site agreements and access requirements next, especially permission to use the land, water access, soil history, and how long the site would be available.",
      },
      {
        kind: "status",
        text: "Web research subagent is comparing site-selection guidance…",
        tone: "action",
      },
    ],
  },
];

const inspector: InspectorData = {
  usage: [
    ["Session cost", "$0.12"],
    ["Run time", "32s"],
    ["Output", "62 tok/s"],
    ["Cache hit", "74%"],
  ],
  tokens: [
    ["Input", "8,240"],
    ["Output", "1,180"],
    ["Cache read", "12,600"],
  ],
};

export const chatScenario = {
  chats,
  messages,
  inspector,
  selectedChat: chats[0],
  changes: { count: 0, added: 0, removed: 0 },
  context: contextUsage,
  model: "Claude Sonnet",
  reasoning: "Medium",
};
