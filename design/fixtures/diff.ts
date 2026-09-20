import type { DiffLine } from "../models/diff.ts";

export const diffLines: DiffLine[] = [
  {
    kind: "context",
    text:
      "  18  export async function renameSession(\n  19    id: string,\n  20    title: string,\n  21  ) {",
  },
  { kind: "removed", text: "− 22    await api.renameSession(id, title);" },
  {
    kind: "added",
    text:
      "+ 22    const session = await api.renameSession(id, title);\n+ 23    sessions.update(id, session);\n+ 24    return session;",
  },
  { kind: "context", text: "  25  }" },
];
