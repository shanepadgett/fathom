import type { FileNode } from "../models/files.ts";

export const changedFiles: FileNode[] = [
  { id: "store", name: "session-store.ts", icon: "file-ts", status: "M" },
  { id: "list", name: "session-list.ts", icon: "file-ts", status: "M" },
  { id: "test", name: "session.test.ts", icon: "file-ts", status: "A" },
];

export const files: FileNode[] = [
  {
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
        children: [
          {
            id: "sessions",
            name: "sessions",
            children: [
              changedFiles[0],
              changedFiles[1],
              {
                id: "session",
                name: "session.ts",
                icon: "file-ts",
              },
            ],
          },
        ],
      },
      { id: "tests", name: "tests", children: [changedFiles[2]] },
      { id: "deno", name: "deno.json", icon: "brackets-curly" },
      { id: "readme", name: "README.md", icon: "file-text" },
    ],
  },
];
