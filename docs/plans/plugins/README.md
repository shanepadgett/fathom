# Harness plugin planning

Plan one plugin before implementing it. Each plan must name its public contracts,
owned state, required services, contributions, UI surfaces, disable/reload behavior,
and manual acceptance checks. Confirm the behavior and boundaries before starting
the next plugin. These entries are a roadmap, not approved implementation plans.

| Order | Plugin | Decision to settle in its plan |
| --- | --- | --- |
| 1 | sessions | Session identity, history/record format, storage versioning, and recovery |
| 2 | tools | Schemas, execution context, result format, middleware, cancellation, and leases |
| 3 | approvals | Who requests approval, how it binds to validated arguments, and how pending approval ends |
| 4 | tools-coding | Read/write/shell behavior, workspace boundaries, and use of the approvals contract |
| 5 | agent | Run ownership, model/tool loop, persistence, cancellation, and interrupted-run recovery |
| 6 | conversation UI | Rendering session records, streaming updates, and extension slots |
| 7 | composer and drafts | Submit contract, draft ownership/persistence, attachments, and reload handoff |

Commands, editor features, theme selection, richer settings, and native desktop
integration get plans when their owning behavior is needed. Provider expansion
also gets a scoped plan: tool calls, multimodal content, reasoning, usage, and
provider-specific request options are beyond the initial text workbench.

The foundation should change only when a plugin's concrete requirements expose a
missing general contract. Avoid adding speculative framework features for future
plugins.
