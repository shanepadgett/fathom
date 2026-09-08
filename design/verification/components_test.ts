/// <reference lib="deno.ns" />
import { meter, text } from "../primitives/content.ts";
import { changedFilesList, fileTree } from "../composites/files.ts";
import { chatListItem } from "../composites/sessions.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import { screens } from "../navigation.ts";
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
Deno.test("text is escaped in text and attribute positions", () => {
  const hostile = '<script title="x">&\'</script>';
  assert(
    text(hostile) ===
      "&lt;script title=&quot;x&quot;&gt;&amp;&#39;&lt;/script&gt;",
    "escaping boundary failed",
  );
  const row = chatListItem(
    { ...scenario.chats[0], title: hostile },
    scenario.projects[0],
  );
  assert(!row.includes("<script"), "chat title became markup");
  assert(row.includes(`title="${text(hostile)}"`), "attribute not escaped");
});
Deno.test("meter bounds and fill derive from the same data", () => {
  assert(
    meter(48, 200, "Context").includes("width:24%"),
    "fill must match value",
  );
  assert(
    meter(250, 200, "Context").includes('aria-valuenow="200"'),
    "maximum clamp",
  );
  assert(
    !meter(NaN, 0, "Context").includes("NaN"),
    "invalid data escaped normalization",
  );
});
Deno.test("static tree expansion and Changes share file row rendering", () => {
  const closed = fileTree(scenario.files, scenario.selectedFile, []);
  const open = fileTree(
    scenario.files,
    scenario.selectedFile,
    scenario.expandedFolders,
  );
  assert(!closed.includes("session-store.ts"), "collapsed children visible");
  assert(open.includes("session-store.ts"), "expanded children missing");
  assert(!open.includes("<details"), "tree remains interactive");
  const changes = changedFilesList(
    scenario.changedFiles,
    scenario.selectedFile,
    scenario.changes,
  );
  assert(
    (changes.match(/data-file-row/g) ?? []).length === 3,
    "changes must reuse file rows",
  );
});
Deno.test("all workspace states compose shared chrome and static controls", () => {
  assert(screens.length === 8, "missing workspace state");
  for (const entry of screens) {
    const html = entry.examples[0].markup;
    assert(html.includes("data-workspace "), `${entry.id}: missing shell`);
    assert(
      html.includes('data-component="workspace-status"'),
      `${entry.id}: missing footer`,
    );
    assert(
      !/<(?:dialog|details|input)\b|href=|\son\w+=/.test(html),
      `${entry.id}: interactive application behavior`,
    );
    assert(!/\sid=/.test(html), `${entry.id}: globally scoped IDs`);
    if (entry.id.startsWith("agent") || entry.id === "editor-focus-drawer") {
      assert(
        html.includes('data-component="composer"'),
        `${entry.id}: missing shared composer`,
      );
      assert(html.includes("Medium"), `${entry.id}: stale model label`);
    }
  }
});
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
  const paths = [
    "tokens.css",
    "styles.css",
    "components/button.css",
    "components/motion.css",
  ];
  const sources = await Promise.all(
    paths.map((path) => Deno.readTextFile(path)),
  );
  const defined = new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])
    ),
  );
  // Set by the shared drag controller, with a CSS fallback before interaction.
  defined.add("--resized-panel-width");
  for (let index = 0; index < sources.length; index++) {
    for (const match of sources[index].matchAll(/var\((--[\w-]+)/g)) {
      assert(
        defined.has(match[1]),
        `${paths[index]}: undefined token ${match[1]}`,
      );
    }
  }
});

Deno.test("renderers preserve dependency boundaries and avoid inline visual dimensions", async () => {
  for (
    const root of [
      "primitives",
      "composites",
      "layouts",
      "screens",
      "site",
      "components",
    ]
  ) {
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
          !/<[a-z][^>]*>/.test(source),
          `${path}: screen owns markup instead of selecting compositions`,
        );
      }
    }
  }
});
