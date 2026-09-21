# Fathom

A coding harness where every feature is a plugin, packaged as a native desktop
app with Deno.

```bash
mise install
deno task dev
```

- [Quickstart](docs/quickstart.md): run it, scaffold a plugin, see it reload.
- [Concepts](docs/concepts.md): plugin, contract, service, registry, slot, scope.
- [Architecture](docs/architecture.md): what is a plugin, what is harness, and why.
- Guides: [settings page](docs/guides/settings-page.md),
  [backend API](docs/guides/backend-api.md),
  [provide a service](docs/guides/provide-a-service.md),
  [publish a contract](docs/guides/publish-a-contract.md).
- Reference: [SDK](docs/reference/sdk.md), [controls](docs/reference/controls.md),
  [manifest](docs/reference/manifest.md), [bundled plugins](docs/reference/plugins.md).

Tasks: `deno task dev` (native window, hot reload), `deno task dev:browser`
(browser tab for DevTools), `deno task new <id>` (scaffold a plugin),
`deno task desktop:build` (package `dist/Fathom.app`), `mise run check`
(format, lint, types, generated docs).
