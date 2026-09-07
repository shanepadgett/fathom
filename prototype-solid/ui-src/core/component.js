import { createSignal, onCleanup } from "solid-js";
import { createStore, reconcile } from "solid-js/store";

export function useHostState(host) {
  const [state, setState] = createStore(host.state.get());
  onCleanup(host.state.subscribe((next) => setState(reconcile(next))));
  return state;
}

export function useRegistry(host) {
  const [revision, setRevision] = createSignal(0);
  onCleanup(host.onRegistryChange(() => setRevision((value) => value + 1)));
  return revision;
}
