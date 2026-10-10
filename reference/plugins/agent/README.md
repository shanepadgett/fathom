# agent

A Fathom plugin.

- `lib/fathom_agent_runtime.ex`: the context, this plugin's public API.
- `lib/fathom_agent_runtime/plugin.ex`: the manifest: what it requires, provides, and contributes.
- `lib/fathom_agent_runtime/application.ex`: the supervision tree, ending with the publisher.
- `lib/fathom_agent_runtime_web/`: LiveViews contributed to the application's slots.

The host discovers this project under `plugins/` or `examples/`. Run
`mise run dev` from the repository root, then edit and save: the running app
reloads the code in place.
