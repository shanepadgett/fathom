const STORAGE_KEY = "fathom.viewport-scale";
const ZOOM_LEVELS = [0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const COMMAND_EVENT = "fathom:view-command";

function readScale() {
  try {
    const stored = Number.parseFloat(localStorage.getItem(STORAGE_KEY) || "1");
    return ZOOM_LEVELS.includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

function saveScale(scale) {
  try {
    localStorage.setItem(STORAGE_KEY, String(scale));
  } catch {
    // Zoom still works when storage is unavailable.
  }
}

export default {
  id: "ui.viewport-scale",
  apiVersion: 1,
  activate(host) {
    let scale = readScale();

    function apply(next) {
      scale = next;
      document.documentElement.style.setProperty(
        "--interface-scale",
        String(scale),
      );
      saveScale(scale);
      globalThis.dispatchEvent(
        new CustomEvent("fathom:viewport-scale-changed", {
          detail: { scale },
        }),
      );
    }

    function change(direction) {
      const current = ZOOM_LEVELS.indexOf(scale);
      const next = Math.min(
        ZOOM_LEVELS.length - 1,
        Math.max(0, current + direction),
      );
      apply(ZOOM_LEVELS[next]);
    }

    const commands = {
      "view.zoomIn": () => change(1),
      "view.zoomOut": () => change(-1),
      "view.resetZoom": () => apply(1),
    };
    for (const [id, command] of Object.entries(commands)) {
      host.registerCommand(id, command);
    }

    function onKeyDown(event) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      let command;
      if (
        event.key === "+" || event.key === "=" || event.code === "NumpadAdd"
      ) command = "view.zoomIn";
      else if (
        event.key === "-" || event.key === "_" ||
        event.code === "NumpadSubtract"
      ) command = "view.zoomOut";
      else if (event.key === "0" || event.code === "Numpad0") {
        command = "view.resetZoom";
      } else return;
      event.preventDefault();
      commands[command]();
    }

    function onViewCommand(event) {
      const command = commands[event.detail];
      command?.();
    }

    apply(scale);
    globalThis.addEventListener("keydown", onKeyDown, { capture: true });
    globalThis.addEventListener(COMMAND_EVENT, onViewCommand);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown, { capture: true });
      globalThis.removeEventListener(COMMAND_EVENT, onViewCommand);
      document.documentElement.style.removeProperty("--interface-scale");
    };
  },
};
