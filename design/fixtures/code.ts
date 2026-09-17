import type { CodeLine } from "../models/code.ts";

// Plain syntax tokens keep significant code whitespace out of HTML formatting.
export const codeLines: CodeLine[] = [
  {
    tokens: [
      { text: "import", tone: "action" },
      " { createStore } ",
      { text: "from", tone: "action" },
      " ",
      { text: '"../state/store.ts"', tone: "success" },
      ";",
    ],
  },
  {
    tokens: [
      { text: "import", tone: "action" },
      " { api } ",
      { text: "from", tone: "action" },
      " ",
      { text: '"../api.ts"', tone: "success" },
      ";",
    ],
  },
  {
    tokens: [
      { text: "import type", tone: "action" },
      " { Session } ",
      { text: "from", tone: "action" },
      " ",
      { text: '"./session.ts"', tone: "success" },
      ";",
    ],
  },
  { tokens: [" "] },
  {
    tokens: [{ text: "export const", tone: "action" }, " sessions = createStore<Session>();"],
  },
  { tokens: [" "] },
  {
    tokens: [{ text: "export async function", tone: "action" }, " loadSessions() {"],
  },
  {
    tokens: [
      "  ",
      { text: "const", tone: "action" },
      " result = ",
      {
        text: "await",
        tone: "action",
      },
      " api.listSessions();",
    ],
  },
  { tokens: ["  sessions.replace(result);"] },
  { tokens: ["}"] },
  { tokens: [" "] },
  {
    tokens: [
      {
        text: "// Keep every view of this session in sync.",
        tone: "neutral",
      },
    ],
  },
  {
    tokens: [{ text: "export async function", tone: "action" }, " renameSession("],
  },
  { tokens: ["  id: ", { text: "string", tone: "warning" }, ","] },
  { tokens: ["  title: ", { text: "string", tone: "warning" }, ","] },
  { tokens: [") {"] },
  {
    tokens: [
      "  ",
      { text: "const", tone: "action" },
      " session = ",
      {
        text: "await",
        tone: "action",
      },
      " api.renameSession(id, title);",
    ],
  },
  {
    tokens: [{ text: "  sessions.update(id, session);", tone: "success" }],
    added: true,
  },
  { tokens: ["  ", { text: "return", tone: "action" }, " session;"] },
  { tokens: ["}"] },
];
