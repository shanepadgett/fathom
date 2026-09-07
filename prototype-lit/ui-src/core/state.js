export function createState() {
  let current = {
    bootstrap: null,
    liveText: "",
    activeTool: null,
    error: "",
    connected: false,
  };
  const listeners = new Set();
  return {
    get: () => current,
    patch(patch) {
      current = { ...current, ...patch };
      listeners.forEach((listener) => listener(current));
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
  };
}
