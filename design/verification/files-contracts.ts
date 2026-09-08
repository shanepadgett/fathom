import { html } from "lit";

import "../composites/changed-files-list.ts";
import "../composites/file-tree.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import { assert, type ContractHost } from "./contract-host.ts";

export async function filesContracts({ host, mount }: ContractHost) {
  for (const expanded of [[], scenario.expandedFolders, []]) {
    await mount(html`
      <file-tree
        .nodes=${scenario.files}
        .selected=${scenario.selectedFile}
        .expanded=${expanded}
      ></file-tree>
    `);
    assert(
      host.textContent!.includes("session-store.ts") === !!expanded.length,
      "tree did not render its supplied expansion state",
    );
    assert(!host.querySelector("details"), "static tree became interactive");
  }
  await mount(html`
    <changed-files-list
      .files=${scenario.changedFiles}
      .selected=${scenario.selectedFile}
      .changes=${scenario.changes}
    ></changed-files-list>
  `);
  assert(
    host.querySelectorAll("file-item [data-file-row]").length === 3,
    "Changes no longer shares file rows",
  );
}
