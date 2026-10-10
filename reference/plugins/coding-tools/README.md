# coding-tools

A Fathom plugin.

- `lib/fathom_coding_tools.ex`: the context, this plugin's public API.
- `lib/fathom_coding_tools/plugin.ex`: the manifest: what it requires, provides, and contributes.
- `lib/fathom_coding_tools/application.ex`: the supervision tree, ending with the publisher.

The host discovers this project under `plugins/` or `examples/`. Run
`mise run dev` from the repository root, then edit and save: the running app
reloads the code in place.
