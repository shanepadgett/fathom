import { resolve } from "node:path";

const [id] = Deno.args;

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  throw new Error(
    "Usage: mise run new <plugin-id> (lowercase, digits, dashes)",
  );
}

const root = resolve(import.meta.dirname!, "..");
const dir = `${root}/plugins/${id}`;

try {
  await Deno.stat(dir);
  throw new Error(`${dir} already exists`);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) {
    throw error;
  }
}

const label = id
  .split("-")
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join(" ");

const pascal = label.replaceAll(" ", "");

const files: Record<string, string> = {
  "deno.json": `${JSON.stringify(
    {
      version: "0.1.0",
      fathom: { id, backend: "backend/mod.ts", ui: "ui/mod.tsx" },
    },
    null,
    2,
  )}\n`,

  "contract.ts": `import { defineApi, query, T } from "@fathom/sdk";

/** What the page may ask the backend; the schemas are checked on both sides. */
export const ${pascal}Api = defineApi("${id}", {
  hello: query({
    input: T.Object({}),
    output: T.Object({ message: T.String() }),
  }),
});
`,

  "backend/mod.ts": `import { Api, definePlugin } from "@fathom/sdk";
import { ${pascal}Api } from "../contract.ts";

export default definePlugin({
  id: "${id}",
  requires: { api: Api },
  start({ api }) {
    api.serve(${pascal}Api, {
      hello: () => ({ message: "Hello from ${label}" }),
    });
  },
});
`,

  "ui/mod.tsx": `import { definePlugin } from "@fathom/sdk";
import { SettingsSections } from "@fathom/sdk/ui";
import { ${pascal}Api } from "../contract.ts";
import { ${pascal}Settings } from "./${pascal}Settings.tsx";

export default definePlugin({
  id: "${id}",
  requires: { api: ${pascal}Api, settings: SettingsSections },
  start({ api, settings }) {
    settings.add(
      {
        label: "${label}",
        icon: "sliders-horizontal",
        component: () => <${pascal}Settings api={api} />,
      },
      { id: "settings", order: 50 },
    );
  },
});
`,

  [`ui/${pascal}Settings.tsx`]: `import { createSignal, onMount } from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import { Card, SettingRow, SettingsSection } from "@fathom/sdk/ui";
import type { ${pascal}Api } from "../contract.ts";

export function ${pascal}Settings(props: {
  api: ApiClient<typeof ${pascal}Api.operations>;
}) {
  const [message, setMessage] = createSignal("…");

  onMount(() => {
    void props.api.hello({}).then((reply) => setMessage(reply.message));
  });

  return (
    <SettingsSection title="${label}">
      <Card padding="rows">
        <SettingRow label="Backend says" description="Fetched through the typed API.">
          <span class="type-label">{message()}</span>
        </SettingRow>
      </Card>
    </SettingsSection>
  );
}
`,
};

for (const [path, content] of Object.entries(files)) {
  const target = `${dir}/${path}`;
  await Deno.mkdir(resolve(target, ".."), { recursive: true });
  await Deno.writeTextFile(target, content);
}

console.log(`Created plugins/${id}. Run: mise run dev`);
