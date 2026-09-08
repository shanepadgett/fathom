import type {
  Chat,
  FileNode,
  InspectorData,
  Message,
  Project,
  WorkspaceScenario,
} from "../models.ts";
export const projects: Project[] = [
  { id: "fathom", name: "Fathom", path: "~/dev/open-source/fathom" },
  { id: "design", name: "Design reference", path: "~/dev/design-reference" },
];
export const chats: Chat[] = [
  {
    id: "rename",
    title: "Keep session titles in sync",
    projectId: "fathom",
    branch: "main",
    time: "Now",
    status: "Reviewing changes",
  },
  {
    id: "trust",
    title: "Add workspace trust prompt",
    projectId: "fathom",
    branch: "workspace-trust",
    time: "2h",
  },
  {
    id: "reconnect",
    title: "Trace reconnect behavior",
    projectId: "fathom",
    branch: "main",
    time: "1d",
  },
  {
    id: "context",
    title: "Review context accounting",
    projectId: "fathom",
    branch: "main",
    time: "1d",
  },
  {
    id: "layouts",
    title: "Refine workspace layouts",
    projectId: "design",
    branch: "main",
    time: "2d",
  },
];
export const changedFiles: FileNode[] = [
  { id: "store", name: "session-store.ts", icon: "file-ts", status: "M" },
  { id: "list", name: "session-list.ts", icon: "file-ts", status: "M" },
  { id: "test", name: "session.test.ts", icon: "file-ts", status: "A" },
];
export const files: FileNode[] = [{
  id: "root",
  name: "fathom",
  children: [
    {
      id: "docs",
      name: "docs",
      children: [{ id: "docs-readme", name: "README.md", icon: "file-text" }],
    },
    {
      id: "src",
      name: "src",
      children: [{
        id: "sessions",
        name: "sessions",
        children: [changedFiles[0], changedFiles[1], {
          id: "session",
          name: "session.ts",
          icon: "file-ts",
        }],
      }],
    },
    { id: "tests", name: "tests", children: [changedFiles[2]] },
    { id: "deno", name: "deno.json", icon: "brackets-curly" },
    { id: "readme", name: "README.md", icon: "file-text" },
  ],
}];
export const messages: Message[] = [
  {
    author: "You",
    time: "10:42",
    blocks: [{
      kind: "prose",
      text:
        "Keep the session list in sync when I rename a session. It should update immediately, without refreshing the workspace.",
    }],
  },
  {
    author: "Fathom",
    time: "10:42",
    agent: true,
    blocks: [
      {
        kind: "prose",
        text:
          "The rename is saved, but the sidebar still reads the old session title. I’ll update the shared session state so both views stay in sync.",
      },
      {
        kind: "tool",
        label: "Read 3 files",
        duration: "0.8s",
        files: changedFiles.map((file) => file.name),
      },
      {
        kind: "prose",
        text:
          "I’ve moved the title update into the session store. The sidebar now uses that same value.",
      },
      {
        kind: "changes",
        description:
          "Shared state update and a test for renaming the active session.",
      },
      {
        kind: "status",
        text: "Reviewing the changes before running tests…",
        tone: "action",
      },
    ],
  },
  {
    author: "You",
    time: "10:43",
    blocks: [{
      kind: "prose",
      text:
        "Also check what happens when I switch between chats. Each conversation should keep its own title, and the selected chat should stay selected after a rename.",
    }],
  },
  {
    author: "Fathom",
    time: "10:43",
    agent: true,
    blocks: [
      {
        kind: "prose",
        text:
          "The selection uses the session ID, so changing the title should keep you in the same conversation. I’m checking the inactive session path as well, where the sidebar updates while another chat is open.",
      },
      {
        kind: "tool",
        label: "Inspect session subscriptions",
        duration: "1.2s",
        files: ["session-store.ts", "session-list.ts"],
      },
      {
        kind: "prose",
        text:
          "Both views subscribe to the same session record. The rename updates that record without replacing the session ID or changing the current selection. Existing messages and the running agent stay attached to the conversation.",
      },
    ],
  },
  {
    author: "You",
    time: "10:44",
    blocks: [{
      kind: "prose",
      text:
        "That sounds right. Make sure a longer title still truncates cleanly in the sidebar and that I can read the full title in the conversation header.",
    }],
  },
  {
    author: "Fathom",
    time: "10:44",
    agent: true,
    blocks: [
      {
        kind: "prose",
        text:
          "I’ve included a longer title in the review cases, along with switching away and back after a rename. The sidebar keeps its compact layout, and the header continues to use the updated title.",
      },
      {
        kind: "tool",
        label: "Review rename coverage",
        duration: "0.6s",
        files: ["session.test.ts"],
      },
      {
        kind: "prose",
        text:
          "The review now covers renaming the active chat, renaming an inactive chat, and preserving selection across repeated updates. I’m checking the assertions before running the focused tests.",
      },
      {
        kind: "status",
        text: "Reviewing session title and selection assertions…",
        tone: "action",
      },
    ],
  },
];
export const inspector: InspectorData = {
  usage: [["Session cost", "$0.18"], ["Run time", "24s"], [
    "Output",
    "68 tok/s",
  ], ["Cache hit", "86%"]],
  tokens: [["Input", "12,480"], ["Output", "1,620"], ["Cache read", "35,200"]],
  servers: ["TypeScript", "CSS"],
  environment: "Local workspace",
  environmentDetail: "2 tools running · 4 plugins",
};
export const scenario: WorkspaceScenario = {
  projects,
  chats,
  files,
  changedFiles,
  messages,
  inspector,
  selectedChat: chats[0],
  selectedFile: "store",
  expandedFolders: ["root", "src", "sessions", "tests"],
  searchChats: [chats[0], chats[1], chats[4]],
  changes: { count: changedFiles.length, added: 24, removed: 8 },
  selectedDiff: { added: 12, removed: 4 },
  context: { value: 48, maximum: 200 },
  model: "Claude Sonnet",
  reasoning: "Medium",
  path: ["src", "sessions", "session-store.ts"],
};
