import type { PluginContext } from "../../sdk/mod.ts";

type Choice = { url: string; serverId?: string };
type View = { id: string; sessionId: string };

/** Coordinates the existing browser owner; never creates a browser connection. */
export function browserPairing(
  ctx: PluginContext,
  navigate: (url: string) => Promise<{ url: string }>,
  resume: () => Promise<void>,
  suspend: () => Promise<void>,
) {
  const discovery = ctx.get("devServers");
  const choices = new Map<string, Choice>();
  let view: View | undefined;
  let generation = 0;
  let pageRevision = 0;
  let ready = false;
  let disposed = false;
  let targetKey = "";
  let queue = Promise.resolve();
  const status = () => ({
    viewId: view?.id,
    sessionId: view?.sessionId,
    ready,
    url: view ? (choices.get(view.sessionId)?.url ?? "") : "",
  });
  const publish = () =>
    ctx.get("events").publish({
      type: "browser-pairing",
      sessionId: view?.sessionId,
      data: status(),
    });
  const reconcile = (force = false): Promise<void> => {
    if (!view || disposed) return Promise.resolve();
    const current = view;
    const servers = discovery
      .snapshot()
      .servers.filter((server) => server.sessionId === current.sessionId);
    let choice = choices.get(current.sessionId);
    if (choice?.serverId && !servers.some((server) => server.id === choice!.serverId)) {
      choices.delete(current.sessionId);
      choice = undefined;
    }
    if (!choice && servers[0]) {
      choice = { url: servers[0].url, serverId: servers[0].id };
      choices.set(current.sessionId, choice);
    }
    const target = choice?.url ?? "about:blank";
    const key = `${current.id}:${choice?.serverId ?? "manual"}:${target}`;
    if (!force && key === targetKey) return queue;
    targetKey = key;
    const revision = ++generation;
    ready = false;
    publish();
    const task = queue.then(async () => {
      if (disposed || revision !== generation) {
        throw new Error("Browser navigation superseded");
      }
      await suspend();
      if (disposed || revision !== generation) {
        throw new Error("Browser navigation superseded");
      }
      const result = await navigate(target);
      if (disposed || revision !== generation) {
        throw new Error("Browser navigation superseded");
      }
      if (choice) choice.url = result.url;
      targetKey = `${current.id}:${choice?.serverId ?? "manual"}:${result.url}`;
      ready = target !== "about:blank";
      publish();
      if (ready) await resume();
    });
    queue = task.catch((error) => {
      if (disposed || revision !== generation) return;
      ctx.get("events").publish({
        type: "browser-pairing-error",
        sessionId: current.sessionId,
        data: {
          viewId: current.id,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    });
    return task;
  };
  const open = async (value: string, sessionId: string) => {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw new Error("Use an HTTP(S) address without credentials");
    ctx.get("storage").getSession(sessionId);
    choices.set(sessionId, { url: url.href });
    if (!view || view.sessionId !== sessionId) {
      view = { id: crypto.randomUUID(), sessionId };
    }
    await reconcile(true);
    return { url: url.href };
  };
  const disposers = [
    discovery.subscribe(() => {
      void reconcile().catch(() => {});
    }),
    ctx.get("rpc").register("browser.attach", async (params) => {
      const sessionId = String(params.sessionId);
      ctx.get("storage").getSession(sessionId);
      view = { id: String(params.viewId), sessionId };
      await reconcile(true);
      return status();
    }),
    ctx.get("rpc").register("browser.detach", async (params) => {
      if (view?.id === params.viewId) {
        view = undefined;
        generation++;
        ready = false;
        targetKey = "";
        await suspend();
      }
      return {};
    }),
    ctx.get("rpc").register("browser.select-server", async (params) => {
      if (!view || view.id !== params.viewId) {
        throw new Error("Browser view changed");
      }
      const server = discovery
        .snapshot()
        .servers.find((server) => server.id === params.id && server.sessionId === view!.sessionId);
      if (!server) throw new Error("Development server exited");
      choices.set(view.sessionId, { url: server.url, serverId: server.id });
      await reconcile(true);
      return status();
    }),
    ctx.get("rpc").register("browser.open", (params) => {
      if (params.viewId !== undefined && view?.id !== params.viewId) {
        throw new Error("Browser view changed");
      }
      const sessionId = params.sessionId === undefined ? view?.sessionId : String(params.sessionId);
      if (!sessionId) throw new Error("Supply a browser sessionId");
      return open(String(params.url), sessionId);
    }),
  ];
  ctx.effect(() => () => {
    disposed = true;
    generation++;
    for (const dispose of disposers) dispose();
    choices.clear();
  });
  return {
    open,
    assertView(id: unknown, requireReady = true) {
      if (disposed || (requireReady && !ready) || !view || view.id !== id) {
        throw new Error("Browser view changed or is navigating");
      }
    },
    captureOwner(id: unknown, sessionId: string) {
      const revision = generation;
      const page = pageRevision;
      const assert = () => {
        if (
          disposed ||
          !ready ||
          generation !== revision ||
          pageRevision !== page ||
          view?.id !== id ||
          view?.sessionId !== sessionId
        ) {
          throw new Error("The browser page changed. Select the page again.");
        }
      };
      assert();
      return assert;
    },
    invalidate() {
      generation++;
      ready = false;
      targetKey = "";
      publish();
    },
    sessionId: () => (ready ? view?.sessionId : undefined),
    viewId: () => (ready ? view?.id : undefined),
    remember(url: string) {
      pageRevision++;
      if (!ready || !view) return;
      const choice = choices.get(view.sessionId);
      if (choice) {
        // Links and redirects retain their route until the associated terminal exits.
        choice.url = url;
        targetKey = `${view.id}:${choice.serverId ?? "manual"}:${url}`;
      }
    },
  };
}
