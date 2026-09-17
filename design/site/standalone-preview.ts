import { html, render } from "lit";

import { components } from "./component-catalog.ts";
import { screens } from "./screen-catalog.ts";
import { setupScreenReturn } from "./screen-return.ts";

export function renderStandalonePreview(params: URLSearchParams) {
  const screenOnly = params.has("screen");
  const preview = params.has("preview");
  const entry = (screenOnly ? screens : components).find(
    (entry) => entry.id === params.get(screenOnly ? "screen" : "preview"),
  );

  const example = entry?.examples[Number(params.get("example") ?? 0)];

  render(
    example
      ? html`
          <main ?data-screen-only=${screenOnly} class=${screenOnly ? "" : "p-4"}>
            ${example.markup}
          </main>
          ${
            screenOnly
              ? html`
                  <div
                    class="viewer-screen-return group/return pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
                  >
                    <a
                      class="ds-button rounded-full shadow-md translate-y-full opacity-0 transition duration-(--motion-duration-fast) ease-exit motion-reduce:transition-none group-data-revealed/return:pointer-events-auto group-data-revealed/return:translate-y-0 group-data-revealed/return:opacity-100 group-data-revealed/return:ease-enter group-focus-within/return:pointer-events-auto group-focus-within/return:translate-y-0 group-focus-within/return:opacity-100 group-focus-within/return:ease-enter [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
                      href=${`./index.html#/screens/${entry!.id}`}
                      >← Back to details</a
                    >
                  </div>
                `
              : null
          }
        `
      : html`<p>${screenOnly ? "Screen" : "Preview"} not found.</p>`,
    document.body,
  );

  document.title = `${entry?.name ?? "Preview"} — Fathom`;

  if (screenOnly && example) setupScreenReturn();

  if (preview && parent !== window) {
    const syncTheme = () => {
      document.documentElement.dataset.theme = parent.document.documentElement.dataset.theme;
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(parent.document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    addEventListener("pagehide", () => observer.disconnect(), { once: true });
  }
}
