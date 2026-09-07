import { createMemo, createSignal, For, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import { useHostState, useRegistry } from "../core/component.js";
import { ContextMeter } from "../components/context-meter.jsx";

function View(props) {
  let node;
  onMount(() => {
    const dispose = props.view.mount(node, props.host);
    onCleanup(() => dispose?.());
  });
  return (
    <section ref={node} class="extension-view" aria-label={props.view.title} />
  );
}

function Shell(props) {
  const host = props.host;
  const state = useHostState(host);
  const revision = useRegistry(host);
  const views = createMemo(() => {
    revision();
    return [...host.views.values()];
  });
  const data = () => state.bootstrap;
  const profiles = () => data()?.profiles || [];
  const [switching, setSwitching] = createSignal(false);
  async function switchProfile(event) {
    const profile = event.currentTarget.value;
    setSwitching(true);
    host.state.patch({ error: "", liveText: "" });
    try {
      await host.transport.command("profile", { profile });
      await host.transport.refresh();
    } catch (error) {
      host.state.patch({ error: error.message });
    } finally {
      setSwitching(false);
    }
  }
  const status = () =>
    !data()
      ? "Connecting"
      : !state.connected
      ? "Reconnecting"
      : data().session.status === "running"
      ? "Working"
      : data().session.status === "idle"
      ? "Idle"
      : data().session.status;
  return (
    <>
      <div class="context-bar">
        <div class="context-brand">
          <h1>
            FATHOM<span>.</span>
          </h1>
        </div>
        <div>
          <span class="eyebrow">Workspace</span>
          <span class="workspace-path" title={data()?.workspace || ""}>
            {data()?.workspace || "Loading workspace"}
          </span>
        </div>
        <div>
          <span class="eyebrow">Model</span>
          <span>
            {data()
              ? `${data().model.provider} / ${data().model.id}`
              : "Connecting…"}
          </span>
        </div>
        <div>
          <label for="runtime" class="eyebrow">Runtime</label>
          <select
            id="runtime"
            aria-label="Runtime composition"
            aria-describedby="runtime-note"
            value={profiles().length ? data()?.profile : "custom"}
            disabled={switching() || !profiles().length ||
              data()?.session.status === "running"}
            onChange={switchProfile}
          >
            <For
              each={profiles()}
              fallback={
                <option value="custom">
                  {data()?.runtime || "Connecting…"}
                </option>
              }
            >
              {(name) => (
                <option value={name}>
                  {name === "default"
                    ? "Default / pi-ai"
                    : name === "echo"
                    ? "Echo / alternate runtime"
                    : name}
                </option>
              )}
            </For>
          </select>
          <small id="runtime-note" class="runtime-note">
            {profiles().length
              ? "Switching starts a fresh session"
              : "Custom composition"}
          </small>
        </div>
      </div>
      <div class="error-banner" role="alert" hidden={!state.error}>
        {state.error}
      </div>
      <div class="workbench">
        <main class="main-view">
          <For each={views().filter((view) => view.slot !== "rail")}>
            {(view) => <View view={view} host={host} />}
          </For>
        </main>
        <aside class="side-rail" aria-label="Plugin composition">
          <For each={views().filter((view) => view.slot === "rail")}>
            {(view) => <View view={view} host={host} />}
          </For>
        </aside>
      </div>
      <footer>
        <span
          class="footer-status status"
          role="status"
          data-state={state.connected ? data()?.session.status : "offline"}
        >
          {status()}
        </span>
        <ContextMeter session={data()?.session} liveText={state.liveText} />
      </footer>
    </>
  );
}
export default {
  id: "ui.shell",
  activate: (host) =>
    render(() => <Shell host={host} />, document.querySelector("#app")),
};
