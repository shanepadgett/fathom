import {
  UI_RUNTIME_IMPORTS,
  type PluginConfigSchema,
  type Static,
} from "@fathom/sdk";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleUi } from "./bundle-ui.ts";
import { buildBrowser } from "./compiler.ts";
import { buildStyles } from "./tailwind.ts";

const ARTIFACT_HASH_HEX_LENGTH = 16;

export interface DiscoveredPlugin {
  source: string;
  manifest: Static<typeof PluginConfigSchema>["fathom"];
}

export interface Artifact {
  id: string;
  url: string;
  styles: string[];
  externals: string[];
}

/** npm package directories resolve through the import map, not node_modules. */
const packageDir = (specifier: string) =>
  fileURLToPath(new URL(".", import.meta.resolve(specifier)));

async function copy(from: string, to: string) {
  await Deno.mkdir(resolve(to, ".."), { recursive: true });
  await Deno.copyFile(from, to);
}

/** Fonts and the icon font, served from /assets so the page needs no network. */
async function stageAssets(root: string) {
  const assets = `${root}/dist/app/assets`;
  const spaceGrotesk = packageDir("@fontsource-variable/space-grotesk");
  const fragmentMono = packageDir("@fontsource/fragment-mono");

  // Phosphor exports no package root, so its regular stylesheet is the anchor.
  const phosphor = fileURLToPath(
    new URL("../../", import.meta.resolve("@phosphor-icons/web/regular")),
  );

  for (const file of [
    "space-grotesk-latin-wght-normal.woff2",
    "space-grotesk-latin-ext-wght-normal.woff2",
  ]) {
    await copy(`${spaceGrotesk}/files/${file}`, `${assets}/fonts/${file}`);
  }

  for (const file of [
    "fragment-mono-latin-400-normal.woff2",
    "fragment-mono-latin-400-italic.woff2",
    "fragment-mono-latin-ext-400-normal.woff2",
    "fragment-mono-latin-ext-400-italic.woff2",
  ]) {
    await copy(`${fragmentMono}/files/${file}`, `${assets}/fonts/${file}`);
  }

  await copy(
    `${spaceGrotesk}/LICENSE`,
    `${assets}/fonts/LICENSE-space-grotesk`,
  );
  await copy(
    `${fragmentMono}/LICENSE`,
    `${assets}/fonts/LICENSE-fragment-mono`,
  );

  await copy(
    `${phosphor}/src/regular/Phosphor.woff2`,
    `${assets}/icons/Phosphor.woff2`,
  );

  await copy(`${phosphor}/LICENSE`, `${assets}/icons/LICENSE-phosphor`);

  const phosphorStyle = await Deno.readTextFile(
    `${phosphor}/src/regular/style.css`,
  );

  await Deno.writeTextFile(
    `${assets}/icons/phosphor.css`,
    phosphorStyle.replaceAll('url("./', 'url("/assets/icons/'),
  );
}

/** The page, the shared runtimes, and their stylesheets. */
async function buildShell(root: string) {
  const entries = [
    ["solid.js", "solid-js", []],
    ["solid-web.js", "solid-js/web", ["solid-js"]],
    ["solid-store.js", "solid-js/store", ["solid-js"]],
    ["sdk.js", "packages/sdk/src/mod.ts", UI_RUNTIME_IMPORTS],
    ["sdk-ui.js", "packages/sdk/src/ui/mod.ts", UI_RUNTIME_IMPORTS],
    ["app.js", "apps/desktop/page/main.tsx", UI_RUNTIME_IMPORTS],
  ] as const;

  const results = new Map<string, { css: string; sources: string[] }>();

  for (const [name, entry, external] of entries) {
    const result = await buildBrowser(entry, {
      directory: root,
      external: [...external],
      alias: {
        "@fathom/renderer": resolve(root, "packages/renderer/mod.ts"),
        "@fathom/kernel": resolve(root, "packages/kernel/mod.ts"),
      },
    });

    const js = result.outputFiles.find((file) => file.path.endsWith(".js"));

    if (!js) {
      throw new Error(`UI build produced no JavaScript output for ${entry}`);
    }

    await Deno.writeFile(`${root}/dist/app/${name}`, js.contents);

    results.set(name, {
      css: result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "",
      sources: Object.keys(result.metafile.inputs)
        .filter((path) => /\.[cm]?[jt]sx?$/.test(path))
        .map((path) => resolve(root, path)),
    });
  }

  const sdkUi = results.get("sdk-ui.js")!;

  // Reset, theme, fonts, typography, control styles, and the utilities used by
  // SDK-owned modules, loaded once by the page.
  await Deno.writeTextFile(
    `${root}/dist/app/ui.css`,
    await buildStyles(sdkUi.css, sdkUi.sources, true),
  );

  const app = results.get("app.js")!;

  await Deno.writeTextFile(
    `${root}/dist/app/app.css`,
    await buildStyles(app.css, app.sources),
  );

  await Deno.copyFile(
    `${root}/apps/desktop/page/index.html`,
    `${root}/dist/app/index.html`,
  );
}

/** One plugin's UI as a content-addressed, immutable artifact. */
export async function buildPluginArtifact(
  root: string,
  plugin: DiscoveredPlugin,
): Promise<Artifact> {
  const { js: bytes, css } = await bundleUi(resolve(plugin.source, ".."));

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(new TextDecoder().decode(bytes) + css),
  );

  const hash = [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, ARTIFACT_HASH_HEX_LENGTH);

  const prefix = `${plugin.manifest.id}/1/${hash}`;
  await Deno.mkdir(`${root}/dist/plugins/${prefix}`, { recursive: true });
  await Deno.writeFile(`${root}/dist/plugins/${prefix}/entry.js`, bytes);

  if (css) {
    await Deno.writeTextFile(`${root}/dist/plugins/${prefix}/style.css`, css);
  }

  return {
    id: plugin.manifest.id,
    url: `/plugins/${prefix}/entry.js`,
    styles: css ? [`/plugins/${prefix}/style.css`] : [],
    externals: UI_RUNTIME_IMPORTS,
  };
}

export async function writeCatalog(root: string, artifacts: Artifact[]) {
  await Deno.writeTextFile(
    `${root}/dist/app/ui-plugins.json`,
    JSON.stringify(artifacts),
  );
}

/** Everything under dist/, from a clean directory. */
export async function buildApp(
  root: string,
  plugins: DiscoveredPlugin[],
): Promise<Artifact[]> {
  await Deno.remove(`${root}/dist/app`, { recursive: true }).catch(() => {});
  await Deno.remove(`${root}/dist/plugins`, { recursive: true }).catch(
    () => {},
  );
  await Deno.mkdir(`${root}/dist/app`, { recursive: true });
  await Deno.mkdir(`${root}/dist/plugins`, { recursive: true });

  await stageAssets(root);
  await buildShell(root);

  const artifacts = [];

  for (const plugin of plugins) {
    if (plugin.manifest.ui) {
      artifacts.push(await buildPluginArtifact(root, plugin));
    }
  }

  await writeCatalog(root, artifacts);

  return artifacts;
}
