import "./components/sidebar-toggle.ts";
import "./components/edge-resizer.ts";
import "./components/button.ts";
import "./components/overlay.ts";
import "./components/accordion.ts";
import "./site/tokens-view.ts";
import { components, screens } from "./navigation.ts";

const params = new URLSearchParams(location.search);
if (params.has("screen")) {
  const entry = screens.find((entry) => entry.id === params.get("screen"));
  const example = entry?.examples[Number(params.get("example") ?? 0)];
  document.body.innerHTML = example
    ? `<main data-screen-only>${example.markup}</main>
      <a class="ds-button fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full shadow-md" href="./index.html#/screens/${
      entry!.id
    }">← Back to details</a>`
    : "<p>Screen not found.</p>";
  document.title = `${entry?.name ?? "Screen"} — Fathom`;
} else if (params.has("preview")) {
  const entry = components.find((entry) => entry.id === params.get("preview"));
  const example = entry?.examples[Number(params.get("example") ?? 0)];
  document.body.innerHTML = example
    ? `<main class="p-4">${example.markup}</main>`
    : "<p>Preview not found.</p>";
  document.title = `${entry?.name ?? "Component"} preview`;

  // These same-origin frames follow the viewer without reloading open examples.
  if (parent !== window) {
    const syncTheme = () => {
      document.documentElement.dataset.theme =
        parent.document.documentElement.dataset.theme;
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(parent.document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    addEventListener("pagehide", () => observer.disconnect(), { once: true });
  }
} else {
  await import("./site/design-app.ts");
}
