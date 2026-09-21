# Add a settings page

The example at `examples/counter` is the smallest complete plugin: a backend
value, a typed API, and a settings section. This guide reads it top to bottom.

## Manifest

```json
{
  "name": "@example/counter",
  "version": "0.1.0",
  "exports": { "./contract": "./contract.ts" },
  "fathom": { "id": "counter", "backend": "backend/mod.ts", "ui": "ui/mod.tsx" }
}
```

`fathom.id` names the plugin. `name` and `exports` exist only because the
contract is importable by other plugins; a plugin nobody imports needs neither.

## Contract

```ts
import { command, defineApi, event, query, T } from "@fathom/sdk";

export const CounterApi = defineApi("counter", {
  read: query({ input: T.Object({}), output: T.Object({ count: T.Number() }) }),
  increment: command({ input: T.Object({}), output: T.Object({}) }),
  changed: event(T.Object({ count: T.Number() })),
});
```

Queries read, commands change, events notify. Every payload has a schema.

## Backend

```ts
import { Api, definePlugin, Storage, T } from "@fathom/sdk";
import { CounterApi } from "../contract.ts";

export default definePlugin({
  id: "counter",
  requires: { api: Api, storage: Storage },
  config: T.Object({
    step: T.Number({ default: 1, description: "How much each click adds." }),
  }),
  start({ api, storage }, config) {
    const current = () => Number(storage.get("count") ?? 0);

    const publication = api.serve(CounterApi, {
      read: () => ({ count: current() }),
      increment: () => {
        const count = current() + config.step;
        storage.set("count", count);
        publication.emit("changed", { count });
        return {};
      },
    });
  },
});
```

`requires` keys arrive on the start context by name. `Storage` is already
scoped to this plugin. `config` is validated and defaulted before `start`
runs, and the plugin manager renders a form from it.

## UI

```tsx
import { definePlugin } from "@fathom/sdk";
import { SettingsSections } from "@fathom/sdk/ui";
import { CounterApi } from "../contract.ts";
import { CounterSettings } from "./CounterSettings.tsx";

export default definePlugin({
  id: "counter",
  requires: { counter: CounterApi, settings: SettingsSections },
  start({ counter, settings }) {
    settings.add(
      { label: "Counter", icon: "plus", component: () => <CounterSettings api={counter} /> },
      { id: "counter", order: 50 },
    );
  },
});
```

Requiring `CounterApi` on the UI side yields the typed client. If the backend
half is disabled, this plugin reports `blocked` and its section disappears;
enabling the backend brings both back.

The component wraps its content in `SettingsSection`, uses `Card` and
`SettingRow`, and subscribes to `changed` inside `onMount` with `onCleanup`.

## Run it

The example lives outside `plugins/`, so register it once:

```bash
deno task plugin:add "$PWD/examples/counter"
deno task dev
```

External plugins start disabled. Enable both halves under **Settings →
Plugins**, then open **Counter**.
