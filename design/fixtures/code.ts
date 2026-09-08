// Trusted, locally authored syntax markup. Never interpolate external text here.
const codeMarkup =
  `<span class="text-action">import</span> { createStore } <span class="text-action">from</span> <span class="text-success">"../state/store.ts"</span>;
<span class="text-action">import</span> { api } <span class="text-action">from</span> <span class="text-success">"../api.ts"</span>;
<span class="text-action">import type</span> { Session } <span class="text-action">from</span> <span class="text-success">"./session.ts"</span>;

<span class="text-action">export const</span> sessions = createStore&lt;Session&gt;();

<span class="text-action">export async function</span> loadSessions() {
  <span class="text-action">const</span> result = <span class="text-action">await</span> api.listSessions();
  sessions.replace(result);
}

<span class="text-muted">// Keep every view of this session in sync.</span>
<span class="text-action">export async function</span> renameSession(
  id: <span class="text-warning">string</span>,
  title: <span class="text-warning">string</span>,
) {
  <span class="text-action">const</span> session = <span class="text-action">await</span> api.renameSession(id, title);
<span class="text-success">  sessions.update(id, session);</span>
  <span class="text-action">return</span> session;
}
`;

export const diffLines: import("../models.ts").DiffLine[] = [
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

export const codeLines: import("../models.ts").CodeLine[] = codeMarkup.trimEnd()
  .split("\n").map((markup) => ({
    markup,
    added: markup.includes("sessions.update"),
  }));
