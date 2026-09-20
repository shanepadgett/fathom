import { UI_RUNTIME_IMPORTS } from "@fathom/sdk";
import { discover } from "./discovery.ts";
import { bundleUi, buildBrowser } from "@fathom/sdk/build";
import * as esbuild from "esbuild";
import { resolve } from "node:path";

const ARTIFACT_HASH_HEX_LENGTH = 16;

const root = resolve(import.meta.dirname!, "../..");

async function bundle(entry: string, external = UI_RUNTIME_IMPORTS) {
  return await buildBrowser(entry, {
    directory: root,
    external,
    alias: {
      "@fathom/host-browser": resolve(root, "packages/host-browser/mod.ts"),
      "@fathom/kernel": resolve(root, "packages/kernel/mod.ts"),
    },
  });
}

await Deno.mkdir(`${root}/dist/app`, { recursive: true });
await Deno.mkdir(`${root}/dist/plugins`, { recursive: true });

try {
  const entries = [
    ["solid.js", "solid-js", []],
    ["solid-web.js", "solid-js/web", ["solid-js"]],
    ["solid-store.js", "solid-js/store", ["solid-js"]],
    ["sdk.js", "packages/sdk/src/mod.ts", UI_RUNTIME_IMPORTS],
    ["sdk-ui.js", "packages/sdk/src/ui/mod.ts", UI_RUNTIME_IMPORTS],
    ["app.js", "apps/ui/main.tsx", UI_RUNTIME_IMPORTS],
  ] as const;

  for (const [name, entry, external] of entries) {
    const result = await bundle(entry, [...external]);

    const js = result.outputFiles.find((file) => file.path.endsWith(".js"));

    if (!js) {
      throw new Error(`UI build produced no JavaScript output for ${entry}`);
    }

    await Deno.writeFile(`${root}/dist/app/${name}`, js.contents);

    const css = result.outputFiles.find((f) => f.path.endsWith(".css"));

    if (css) {
      await Deno.writeFile(
        `${root}/dist/app/${name.replace(".js", ".css")}`,
        css.contents,
      );
    }
  }

  const artifacts = [];

  const home = resolve(
    Deno.env.get("FATHOM_HOME") ?? `${Deno.env.get("HOME")}/.fathom`,
  );

  for (const { source, manifest } of await discover(root, home)) {
    if (!manifest.ui) {
      continue;
    }

    const dir = resolve(source, "..");
    const { js: bytes, css } = await bundleUi(dir);

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(new TextDecoder().decode(bytes) + css),
    );

    const hash = [...new Uint8Array(digest)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, ARTIFACT_HASH_HEX_LENGTH);

    const prefix = `${manifest.id}/1/${hash}`;
    await Deno.mkdir(`${root}/dist/plugins/${prefix}`, { recursive: true });
    await Deno.writeFile(`${root}/dist/plugins/${prefix}/entry.js`, bytes);

    if (css) {
      await Deno.writeTextFile(`${root}/dist/plugins/${prefix}/style.css`, css);
    }

    artifacts.push({
      id: manifest.id,
      url: `/plugins/${prefix}/entry.js`,
      styles: css ? [`/plugins/${prefix}/style.css`] : [],
      sdk: manifest.sdk,
      externals: UI_RUNTIME_IMPORTS,
    });
  }

  await Deno.writeTextFile(
    `${root}/dist/app/ui-plugins.json`,
    JSON.stringify(artifacts),
  );

  const tokens = (await Deno.readTextFile(`${root}/design/tokens.css`))
    .replace("@theme static", ":root")
    .replace(/--\*: initial;/, "");

  await Deno.writeTextFile(
    `${root}/dist/app/theme.css`,
    tokens +
      "\n" +
      (await Deno.readTextFile(`${root}/packages/sdk/src/ui/base.css`)),
  );

  await Deno.copyFile(
    `${root}/apps/ui/styles.css`,
    `${root}/dist/app/styles.css`,
  );

  await Deno.copyFile(
    `${root}/apps/ui/index.html`,
    `${root}/dist/app/index.html`,
  );

  console.log(`Built app and ${artifacts.length} UI plugins.`);
} finally {
  esbuild.stop();
}
