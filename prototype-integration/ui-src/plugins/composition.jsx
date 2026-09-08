import { For, onCleanup } from "solid-js";
import { render } from "solid-js/web";

import { useHostState } from "../core/component.js";

function Composition(props) {
  const state = useHostState(props.host);
  let panel;
  let workbench;
  onCleanup(() => workbench?.classList.remove("rail-collapsed"));
  const data = () => state.bootstrap;
  return (
    <details
      ref={(el) => {
        panel = el;
      }}
      class="composition-panel"
      open
      onToggle={() => {
        workbench = panel.closest(".workbench");
        workbench?.classList.toggle("rail-collapsed", !panel.open);
      }}
    >
      <summary class="section-heading">
        <h2>Composition ({data()?.plugins.length || 0})</h2>
      </summary>
      <div class="composition-body">
        <p class="rail-intro">The harness is the sum of its parts. Every service has an owner.</p>
        <For each={data()?.plugins}>
          {(plugin) => (
            <details class="plugin-entry">
              <summary>
                <span>{plugin.id}</span>
                <span class="plugin-status">{plugin.status}</span>
              </summary>
              <dl>
                <dt>PROVIDES</dt>
                <dd>{plugin.provides.join(", ") || "—"}</dd>
                <dt>REQUIRES</dt>
                <dd>{plugin.requires.join(", ") || "None"}</dd>
              </dl>
            </details>
          )}
        </For>
        <h3 class="tool-heading eyebrow">Available tools</h3>
        <For each={data()?.tools}>
          {(tool) => (
            <details class="tool-entry">
              <summary>{tool.name}</summary>
              <p>{tool.description}</p>
            </details>
          )}
        </For>
        <div class="composition-note">
          BUILT TO BE REPLACED.
          <p>
            {data()?.profiles?.includes("echo")
              ? "Switch to Echo to try an alternate runtime. Switching starts a fresh session."
              : "This workbench runs your custom composition. Its plugins are selected by configuration."}
          </p>
        </div>
      </div>
    </details>
  );
}
export default {
  id: "ui.composition",
  activate: (host) =>
    host.registerView("composition", {
      title: "Composition",
      slot: "rail",
      mount: (container, host) => render(() => <Composition host={host} />, container),
    }),
};
