# Roadmap

The baseline is complete: a native window, an SDK, bundled plugins
that a third party could have written, and a dev loop that reloads plugin
code in place. Finished plans are under `_archive_do_NOT_read_these/` and are
history, not instructions.

## Plugins, in order

Plan one plugin before implementing it. Each plan names its public contracts,
owned state, required services, contributions, UI surfaces, disable and reload
behavior, and manual acceptance checks. Confirm behavior and boundaries before
starting the next one.

| Order | Plugin | Decision to settle in its plan |
| --- | --- | --- |
| 1 | sessions | Session identity, history and record format, storage versioning, recovery |
| 2 | tools | Schemas, execution context, result format, middleware, cancellation, leases |
| 3 | approvals | Who requests approval, how it binds to validated arguments, how pending approval ends |
| 4 | tools-coding | Read, write, and shell behavior, workspace boundaries, use of the approvals contract |
| 5 | agent | Run ownership, model and tool loop, persistence, cancellation, interrupted-run recovery |
| 6 | conversation UI | Rendering session records, streaming updates, extension slots |
| 7 | composer and drafts | Submit contract, draft ownership and persistence, attachments, reload handoff |

Commands, editor features, theme selection, richer settings, and deeper desktop
integration get plans when their owning behavior is needed. Provider expansion
gets a scoped plan: tool calls, multimodal content, reasoning, usage, and
provider-specific request options are beyond the text workbench.

The harness changes only when a plugin's concrete requirements expose a missing
general contract. Do not add framework features for plugins that do not exist.

## Deferred foundation work

The [Elixir harness plan](elixir-harness.md) holds the open harness work:
peer nodes, release packaging, and slot selection. The
[plugin packages plan](plugin-packages.md) covers local plugins (built),
sharing and installing plugins from Hex, and the definition and provider
split.

| Item | State |
| --- | --- |
| Repository license | Not chosen. Blocks publishing `fathom_sdk` to Hex. |
| Adding a plugin directory | Requires restarting `mise run dev`; edits inside a known directory reload in place. |
| Remote install, marketplace, updates | Not started. |
| Signing and notarization | The packaged app is ad-hoc signed. |
| Control coverage | Not every component in `design/` has an SDK control. Menu, accordion, and drag-resizable sidebars from the old SDK are not ported yet. |
