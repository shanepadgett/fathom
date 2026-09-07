export function createHost(state, transport) {
  const views = new Map();
  const renderers = new Map();
  const commands = new Map();
  const listeners = new Set();
  const disposers = new Map();
  const notify = () => listeners.forEach((listener) => listener());
  function register(map, id, value) {
    if (map.has(id)) throw new Error(`Duplicate UI contribution: ${id}`);
    map.set(id, value);
    try {
      notify();
    } catch (error) {
      map.delete(id);
      throw error;
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      map.delete(id);
      notify();
    };
  }
  const host = {
    apiVersion: 1,
    state,
    transport,
    views,
    renderers,
    commands,
    registerView: (id, view) => register(views, id, view),
    registerRenderer: (id, renderer) => register(renderers, id, renderer),
    registerCommand: (id, command) => register(commands, id, command),
    onRegistryChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async activate(plugin) {
      if (!plugin?.id || typeof plugin.activate !== "function") {
        throw new Error("Invalid UI plugin");
      }
      if (
        plugin.apiVersion !== undefined && plugin.apiVersion !== host.apiVersion
      ) {
        throw new Error(
          `UI plugin ${plugin.id} needs unsupported API ${plugin.apiVersion}`,
        );
      }
      for (const dependency of plugin.requires || []) {
        if (!disposers.has(dependency)) {
          throw new Error(
            `UI plugin ${plugin.id} requires ${dependency} to be activated first`,
          );
        }
      }
      if (disposers.has(plugin.id)) return;
      const owned = [];
      const track = (dispose) => {
        owned.push(dispose);
        return dispose;
      };
      const scoped = {
        ...host,
        state: {
          ...state,
          subscribe: (listener) => track(state.subscribe(listener)),
        },
        registerView: (id, view) => track(host.registerView(id, view)),
        registerRenderer: (id, renderer) =>
          track(host.registerRenderer(id, renderer)),
        registerCommand: (id, command) =>
          track(host.registerCommand(id, command)),
        onRegistryChange: (listener) => track(host.onRegistryChange(listener)),
      };
      const cleanup = () => {
        const errors = [];
        for (const dispose of owned.splice(0).reverse()) {
          try {
            dispose();
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length) {
          throw new AggregateError(
            errors,
            `UI plugin ${plugin.id} cleanup failed`,
          );
        }
      };
      try {
        const dispose = await plugin.activate(scoped);
        if (typeof dispose === "function") owned.push(dispose);
        disposers.set(plugin.id, cleanup);
      } catch (error) {
        try {
          cleanup();
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `UI plugin ${plugin.id} failed`,
          );
        }
        throw error;
      }
    },
    dispose() {
      const errors = [];
      for (const dispose of [...disposers.values()].reverse()) {
        try {
          dispose();
        } catch (error) {
          errors.push(error);
        }
      }
      disposers.clear();
      if (errors.length) throw new AggregateError(errors, "UI cleanup failed");
    },
  };
  return host;
}
