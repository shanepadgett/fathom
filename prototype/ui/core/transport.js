export function createTransport(state) {
  let source;
  async function refresh() {
    const response = await fetch("/api/bootstrap");
    if (!response.ok) {
      throw new Error(`Unable to load workbench (${response.status})`);
    }
    const bootstrap = await response.json();
    state.patch({ bootstrap });
    return bootstrap;
  }
  async function command(path, payload = {}) {
    const response = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || body.message || `Request failed (${response.status})`);
    }
    return response.json();
  }
  function connect() {
    source = new EventSource("/api/events");
    source.onopen = () => {
      state.patch({ connected: true });
      refresh().catch((error) => state.patch({ error: error.message }));
    };
    source.onerror = () => state.patch({ connected: false });
    source.onmessage = ({ data }) => {
      try {
        const event = JSON.parse(data);
        const current = state.get();
        if (event.type === "snapshot") {
          state.patch({
            bootstrap: { ...current.bootstrap, session: event.session },
            liveText: "",
            activeTool: null,
          });
        }
        if (event.type === "delta") {
          state.patch({ liveText: current.liveText + event.text });
        }
        if (event.type === "status" && current.bootstrap) {
          if (event.status !== "running") {
            state.patch({ liveText: "", activeTool: null });
          }
          state.patch({
            bootstrap: {
              ...current.bootstrap,
              session: { ...current.bootstrap.session, status: event.status },
            },
          });
        }
        if (event.type === "tool-start") state.patch({ activeTool: event });
        if (event.type === "error") state.patch({ error: event.message });
      } catch (error) {
        state.patch({ error: `Event stream: ${error.message}` });
      }
    };
    return () => source.close();
  }
  return { refresh, command, connect };
}
