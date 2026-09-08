import { html } from "lit";

import "../screens/agent-screen.ts";
import "../screens/editor-screen.ts";
import { screens } from "../site/screen-catalog.ts";
import { assert, type ContractHost } from "./contract-host.ts";

export async function screensContracts({ host, mount }: ContractHost) {
  assert(screens.length === 8, "missing workspace preview state");
  for (const entry of screens) {
    await mount(entry.examples[0].markup);
    assert(
      host.querySelector("workspace-layout workspace-header"),
      `${entry.id}: missing shared header`,
    );
    assert(host.querySelector("workspace-status-bar"), `${entry.id}: missing shared footer`);
    assert(
      !host.querySelector("dialog, details, input, a, [id]"),
      `${entry.id}: application behavior or global IDs`,
    );
    assert(
      !host.textContent!.includes("[object Object]"),
      `${entry.id}: template was coerced to a string`,
    );
    for (const element of host.querySelectorAll("*")) {
      if (element.localName.includes("-")) {
        assert(
          customElements.get(element.localName),
          `${element.localName}: unregistered component`,
        );
      }
    }
    if (entry.id.startsWith("agent") || entry.id === "editor-focus-drawer") {
      assert(host.querySelector("message-composer"), `${entry.id}: missing composer`);
      assert(
        host.textContent!.replace(/\s+/g, " ").includes("Claude Sonnet · Medium"),
        `${entry.id}: model text changed`,
      );
    }
  }

  // Same instances must accept new presentation data, not only work at startup.
  for (const state of ["base", "diff", "projects", "chat-search", "no-session", "base"]) {
    await mount(html`<agent-screen .state=${state}></agent-screen>`);
    assert(
      !!host.querySelector("workspace-drawer") === (state === "diff"),
      "drawer did not follow screen state",
    );
    assert(
      !!host.querySelector("project-picker") === (state === "projects"),
      "project overlay did not follow screen state",
    );
    assert(
      !!host.querySelector("chat-search") === (state === "chat-search"),
      "chat overlay did not follow screen state",
    );
    assert(
      !!host.querySelector("session-inspector") === (state !== "no-session"),
      "inspector did not follow screen state",
    );
  }
  for (const state of ["files", "changes", "agent", "files"]) {
    await mount(html`<editor-screen .state=${state}></editor-screen>`);
    assert(
      !!host.querySelector("changed-files-list") === (state === "changes"),
      "editor tab did not follow screen state",
    );
    assert(
      !!host.querySelector("workspace-drawer") === (state === "agent"),
      "agent drawer did not follow screen state",
    );
  }
  await mount(html`
    <agent-screen></agent-screen>
    <agent-screen></agent-screen>
  `);
  const workspaces = host.querySelectorAll("workspace-layout");
  workspaces[0].querySelector<HTMLButtonElement>("[data-sidebar-toggle]")!.click();
  assert(
    workspaces[0].querySelector("workspace-sidebar[hidden]"),
    "first preview did not close its sidebar",
  );
  assert(
    !workspaces[1].querySelector("workspace-sidebar[hidden]"),
    "sidebar state leaked across previews",
  );
}
