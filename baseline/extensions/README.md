# Extensions

Stand-ins for third-party plugins. They import `../sdk.ts` and merge a key into
`Services`. The host mounts them like anything else.

`logbook` provides `ctx.logbook` on top of `fs`. `tool-logbook` injects
`logbook` and `tools`. It type-imports the logbook contract and never mentions
disk.

Swap the two `.use` rows in `host.ts` and `deno check` fails: the tool’s inject
is not yet provided.
