import { html } from "lit";

import "../composites/chat-list-item.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import { assert, type ContractHost } from "./contract-host.ts";

export async function escapingContracts({ host, mount }: ContractHost) {
  const hostile = '<script title="x">&\'</script>';
  await mount(html`
    <chat-list-item
      .chat=${{ ...scenario.chats[0], title: hostile }}
      .project=${scenario.projects[0]}
      .selected=${true}
    ></chat-list-item>
  `);
  assert(!host.querySelector("script"), "chat text became executable markup");
  assert(
    host.querySelector("p[title]")?.getAttribute("title") === hostile,
    "attribute escaping changed text",
  );
  assert(
    host.querySelector("p[title]")?.textContent?.trim() === hostile,
    "text escaping changed content",
  );
  assert(host.querySelector('[aria-current="true"]'), "selected row lost its accessible state");
}
