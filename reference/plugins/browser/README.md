# browser

A Fathom plugin.

- `lib/fathom_browser.ex`: the context, this plugin's public API.
- `lib/fathom_browser/plugin.ex`: the manifest: what it requires, provides, and contributes.
- `lib/fathom_browser/application.ex`: the supervision tree, ending with the publisher.

The host discovers this project under `plugins/` or `examples/`. Run
`mise run dev` from the repository root, then edit and save: the running app
reloads the code in place.
