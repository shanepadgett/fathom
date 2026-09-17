import type { BrowserPairingState } from "../../sdk/browser.ts";
import type { DevServersSnapshot } from "../../sdk/dev-servers.ts";
import type { Transport } from "../transport.ts";

import { createEffect, createSignal, on, onCleanup } from "solid-js";

export function browserPairing(
  transport: Transport,
  sessionId: () => string,
  change: (state: BrowserPairingState) => void,
  error: (error: unknown) => void,
) {
  const [snapshot, setSnapshot] = createSignal<DevServersSnapshot>({
    revision: -1,
    servers: [],
  });
  const [viewId, setViewId] = createSignal("");
  let refreshGeneration = 0;
  let disposed = false;
  const refresh = async () => {
    const generation = ++refreshGeneration;
    try {
      const result = await transport.request<DevServersSnapshot>("dev-servers.list");
      if (!disposed && generation === refreshGeneration && result.revision >= snapshot().revision)
        setSnapshot(result);
    } catch (failure) {
      if (!disposed && generation === refreshGeneration) error(failure);
    }
  };
  const attach = async (id: string, session: string) => {
    try {
      // State arrives through ordered events, not a potentially superseded RPC response.
      await transport.request("browser.attach", {
        viewId: id,
        sessionId: session,
      });
    } catch (failure) {
      if (!disposed && viewId() === id) error(failure);
    }
  };
  const reconnect = (session: string) => {
    const id = crypto.randomUUID();
    setViewId(id);
    setSnapshot({ revision: -1, servers: [] });
    change({ viewId: id, sessionId: session, ready: false, url: "" });
    void refresh();
    void attach(id, session);
  };
  onCleanup(
    transport.onEvent((event) => {
      if (event.projectId && event.projectId !== transport.projectId) return;
      if (event.type === "dev-servers") {
        const next = event.data as DevServersSnapshot;
        if (next.revision >= snapshot().revision) setSnapshot(next);
      }
      if (event.type === "connected" || event.type === "environment") {
        reconnect(sessionId());
      }
      if (event.sessionId !== sessionId()) return;
      if (event.type === "browser-pairing") {
        const state = event.data as BrowserPairingState;
        if (state.viewId === viewId()) change(state);
      }
      if (event.type === "browser-pairing-error") {
        const failure = event.data as { viewId: string; message: string };
        if (failure.viewId === viewId()) error(new Error(failure.message));
      }
    }),
  );
  createEffect(
    on(sessionId, (session) => {
      reconnect(session);
      onCleanup(() => {
        void transport.request("browser.detach", { viewId: viewId() }).catch(() => {});
      });
    }),
  );
  onCleanup(() => {
    disposed = true;
    refreshGeneration++;
  });
  return {
    viewId,
    servers: () => snapshot().servers.filter((server) => server.sessionId === sessionId()),
    open: (url: string) => transport.request("browser.open", { url, viewId: viewId() }),
    select: (id: string) => transport.request("browser.select-server", { id, viewId: viewId() }),
  };
}
