/// <reference lib="deno.ns" />

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Rendered contracts (escaping, meters, trees, and state updates) run in browser.py.
// Source checks here enforce the boundaries that a visual snapshot cannot show.
Deno.test("design markup has no arbitrary numeric utility values", async () => {
  const roots = ["primitives", "composites", "layouts", "screens", "site"];
  for (const root of roots) {
    for await (const entry of Deno.readDir(root)) {
      if (!entry.name.endsWith(".ts")) continue;
      const source = await Deno.readTextFile(`${root}/${entry.name}`);
      assert(
        !/[\w-]+-\[[^\]\n]*\d[^\]\n]*\]/.test(source),
        `${root}/${entry.name}: raw utility value; use Tailwind scale or a named token`,
      );
    }
  }
});

Deno.test("authored CSS references defined tokens or documented runtime properties", async () => {
  const paths = ["tokens.css", "styles.css"];
  for (const root of ["components", "composites", "layouts", "site"]) {
    for await (const entry of Deno.readDir(root)) {
      if (entry.name.endsWith(".css")) paths.push(`${root}/${entry.name}`);
    }
  }
  const sources = await Promise.all(paths.map((path) => Deno.readTextFile(path)));
  const defined = new Set(
    sources.flatMap((source) => [...source.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])),
  );
  // Set by the push drawer owner, with a CSS fallback before interaction.
  defined.add("--resized-panel-width");
  for (let index = 0; index < sources.length; index++) {
    for (const match of sources[index].matchAll(/var\((--[\w-]+)/g)) {
      assert(defined.has(match[1]), `${paths[index]}: undefined token ${match[1]}`);
    }
  }
});

Deno.test("registered component files have one owner and direct child imports", async () => {
  const registrations = new Map<string, string>();
  const sources = new Map<string, string>();
  for (const root of ["components", "composites", "layouts", "screens", "site"]) {
    for await (const entry of Deno.readDir(root)) {
      if (!entry.name.endsWith(".ts")) continue;
      const path = `${root}/${entry.name}`;
      const source = await Deno.readTextFile(path);
      sources.set(path, source);
      const tags = [...source.matchAll(/customElements\.define\("([\w-]+)"/g)];
      assert(tags.length <= 1, `${path}: multiple registered components`);
      for (const [, tag] of tags) {
        assert(!registrations.has(tag), `${tag}: duplicate registration`);
        registrations.set(tag, path);
        const filename = tag.startsWith("ds-") ? tag.slice(3) : tag;
        assert(entry.name === `${filename}.ts`, `${path}: filename does not match ${tag}`);
      }
    }
  }
  for (const [path, source] of sources) {
    const imports = [...source.matchAll(/import\s+(?:[^;]*?from\s+)?["']([^"']+)["']/g)].map(
      (match) => new URL(match[1], `file:///${path}`).pathname.slice(1),
    );
    for (const [, tag] of source.matchAll(/<([a-z]+-[a-z-]+)\b/g)) {
      const owner = registrations.get(tag);
      assert(!!owner, `${path}: unknown child ${tag}`);
      assert(
        owner === path || imports.includes(owner!),
        `${path}: missing direct import for ${tag}`,
      );
    }
  }
});

Deno.test("renderers preserve dependency boundaries and avoid inline visual dimensions", async () => {
  for (const root of ["primitives", "composites", "layouts", "screens", "site", "components"]) {
    for await (const entry of Deno.readDir(root)) {
      if (!entry.name.endsWith(".ts")) continue;
      const path = `${root}/${entry.name}`;
      const source = await Deno.readTextFile(path);
      if (
        !entry.name.includes(".examples.") &&
        ["primitives", "composites", "layouts", "components"].includes(root)
      ) {
        assert(
          !/from\s+["'][^"']*(?:fixtures\/|navigation\.)/.test(source),
          `${path}: renderer imports fixtures or routes`,
        );
      }
      assert(
        !/style=["'][^"'\n]*(?:\d+(?:px|rem|em|vh|vw)|var\()/.test(source),
        `${path}: inline visual value; use utilities or tokens`,
      );
      if (root === "screens") {
        assert(
          !/<(?:div|section|aside|header|footer|button|span)\b/.test(source),
          `${path}: screen owns appearance instead of composing named elements`,
        );
      }
      assert(
        !/innerHTML\s*=|unsafeHTML\(|\.join\(["']{2}\)/.test(source),
        `${path}: HTML string rendering bypasses Lit composition`,
      );
    }
  }
});

Deno.test("screen families are registered components with visible composition", async () => {
  for (const name of ["agent", "editor"]) {
    const source = await Deno.readTextFile(`screens/${name}-screen.ts`);
    assert(source.includes(`customElements.define("${name}-screen"`), "screen is not registered");
    for (const tag of [
      "workspace-shell",
      "workspace-header",
      "workspace-body",
      "workspace-sidebar",
      "workspace-status-bar",
    ]) {
      assert(source.includes(`<${tag}`), `${name}: ${tag} is hidden outside the screen`);
    }
  }
  for await (const entry of Deno.readDir("layouts")) {
    if (!entry.name.endsWith(".ts")) continue;
    const source = await Deno.readTextFile(`layouts/${entry.name}`);
    assert(!/composites\//.test(source), `${entry.name}: layout selects screen content`);
  }
});
