# Quickstart

Five minutes from a checkout to a plugin you wrote running inside Fathom.

## Run Fathom

```bash
mise install
deno task dev
```

The first command installs the pinned Deno. The second builds the UI and opens
Fathom in its own window with hot reload. If you want Chrome DevTools instead,
run `deno task dev:browser`; it prints a launch link and opens a tab.

## Make a plugin

```bash
deno task new hello
```

This creates `plugins/hello/` with four files:

```text
plugins/hello/
  deno.json          id, backend entry, ui entry
  contract.ts        the API the page may call, as schemas
  backend/mod.ts     serves that API in the Deno process
  ui/mod.tsx         adds a settings section that calls it
  ui/HelloSettings.tsx
```

Restart `deno task dev`. New plugin directories are picked up at start; edits to
an existing plugin are rebuilt and reloaded while it runs.

## See it

Open **Settings** from the gear in the header. **Hello** appears in the
navigation, and its page shows the message the backend returned through the
typed API.

## Change it

Edit the message in `backend/mod.ts` and save. The dev loop reloads the backend
half and the page shows the new text. Edit `ui/HelloSettings.tsx` and the
section re-renders without a refresh.

## Next

- [Concepts](concepts.md): the six words the SDK uses.
- [Add a settings page](guides/settings-page.md): the example plugin, explained.
- [Expose a backend API](guides/backend-api.md): schemas, handlers, events.
- [Provide a service](guides/provide-a-service.md): replace a bundled plugin.
- [SDK reference](reference/sdk.md), [controls](reference/controls.md),
  [manifest](reference/manifest.md).
