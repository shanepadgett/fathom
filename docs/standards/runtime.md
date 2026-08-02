# Runtime package standards

- Remain host-independent. Do not import desktop, renderer, terminal, or application-lifecycle code.
- Consume `@fathom/ai` through its public exports and keep agent-loop, session, tool, approval,
  context, and cancellation policy here.
- Commands, events, snapshots, and durable records crossing runtime boundaries must be plain
  serializable data.
- Persist completed user messages, assistant messages, and tool results at their defined commit
  points. Streaming deltas remain ephemeral.
- Place reusable behavior with its owning runtime concept. Search existing modules before adding
  caller-local helpers or duplicate policy.
