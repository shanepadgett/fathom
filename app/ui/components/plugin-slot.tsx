import type { JSX } from "solid-js";

import type { EntryMount, ViewMount, ViewSlot } from "../../sdk/frontend.ts";
import type { Entry } from "../../sdk/session.ts";
import type { UIHost } from "../host.ts";

import { createSignal, ErrorBoundary, For, onCleanup, onMount, Show } from "solid-js";

export function PluginView(props: { host: UIHost; mount: ViewMount }) {
  let element!: HTMLDivElement;
  let dispose: (() => void | Promise<void>) | undefined;
  onMount(() => {
    dispose = props.mount(element, props.host);
  });
  onCleanup(() => {
    Promise.resolve()
      .then(() => dispose?.())
      .catch((error) => props.host.toast(`Plugin view cleanup failed: ${String(error)}`));
  });
  return <div class="plugin-view" ref={element} />;
}

export function PluginSlot(props: { host: UIHost; slot: ViewSlot }) {
  const [revision, setRevision] = createSignal(0);
  onCleanup(props.host.subscribe(() => setRevision((value) => value + 1)));
  const views = () => {
    revision();
    return [...props.host.views.values()].filter((view) => view.slot === props.slot);
  };
  return (
    <For each={views()}>
      {(view) => (
        <section class="plugin-slot">
          <h3>{view.title}</h3>
          <ErrorBoundary fallback={<p role="alert">This plugin view could not render.</p>}>
            <PluginView host={props.host} mount={view.mount} />
          </ErrorBoundary>
        </section>
      )}
    </For>
  );
}

export function Surface(props: {
  host: UIHost;
  name: "shell" | "transcript" | "editor";
  children: JSX.Element;
}) {
  const [revision, setRevision] = createSignal(0);
  onCleanup(props.host.subscribe(() => setRevision((value) => value + 1)));
  const mount = () => {
    revision();
    return props.host.surfaces.get(props.name);
  };
  return (
    <ErrorBoundary fallback={props.children}>
      <Show when={mount()} fallback={props.children}>
        {(mount) => <PluginView host={props.host} mount={mount()} />}
      </Show>
    </ErrorBoundary>
  );
}

function MountedEntry(props: { host: UIHost; entry: Entry; mount: EntryMount }) {
  let element!: HTMLDivElement;
  let dispose: (() => void | Promise<void>) | undefined;
  onMount(() => {
    dispose = props.mount(element, props.host, () => props.entry);
  });
  onCleanup(() => {
    Promise.resolve()
      .then(() => dispose?.())
      .catch((error) => props.host.toast(`Entry renderer cleanup failed: ${String(error)}`));
  });
  return <div ref={element} />;
}

export function matchingEntryRenderer(host: UIHost, entry: Entry) {
  for (const renderer of host.renderers.values()) {
    try {
      if (renderer.matches(entry)) return renderer;
    } catch {
      /* A broken predicate must not hide the conversation. */
    }
  }
  return undefined;
}

export function EntryContent(props: { host: UIHost; entry: Entry; children: JSX.Element }) {
  const [revision, setRevision] = createSignal(0);
  onCleanup(props.host.subscribe(() => setRevision((value) => value + 1)));
  const renderer = () => {
    revision();
    return matchingEntryRenderer(props.host, props.entry);
  };
  return (
    <ErrorBoundary fallback={props.children}>
      <Show when={renderer()} fallback={props.children}>
        {(renderer) => (
          <MountedEntry host={props.host} entry={props.entry} mount={renderer().mount} />
        )}
      </Show>
    </ErrorBoundary>
  );
}
