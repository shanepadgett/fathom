# Roadmap

The baseline is complete: a native window, one published SDK, bundled plugins
that a third party could have written, and a dev loop that reloads the edited
half of a plugin. Finished plans are under `_archive_do_NOT_read_these/` and are
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

| Item | State |
| --- | --- |
| Repository license | Not chosen. Blocks JSR publication and keeps `publish:check` out of `check`. |
| Slot composition settings | The composition JSON file and the revision-checked API select a shell or sidebar; no UI. |
| WebKit rendering check | Dialog and menu transitions in the native window are unverified. If they degrade, set `"backend": "cef"` in `deno.json`. |
| Adding a plugin directory | Requires restarting `mise run dev`; edits inside a known directory reload in place. |
| Remote install, marketplace, updates | Not started. Local registration is an explicit trust decision. |
| Signing and notarization | The packaged app is ad-hoc signed. |
| Control coverage | Not every component in `design/` has an SDK control. |
