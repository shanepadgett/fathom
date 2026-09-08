import { html } from "lit";

import { background } from "../fixtures/overlay-background.ts";
import "./button.ts";
import "./drawer.ts";
import "./edge-resizer.ts";

export const drawerExamples = ["dimmed", "none"].map((backdrop) => ({
  name: backdrop === "none" ? "Without dimming" : "With dimming",
  markup: html`
    <ds-drawer backdrop="${backdrop}"
      >${background}
      <ds-button><button type="button" data-open>Open drawer</button></ds-button>
      <dialog aria-labelledby="drawer-title-${backdrop}" closedby="any">
        <div data-drawer-scroll>
          <header class="flex items-center justify-between gap-4">
            <h2 id="drawer-title-${backdrop}" class="text-2xl font-semibold tracking-tight">
              Session details
            </h2>
            <ds-button variant="quiet"
              ><button type="button" data-close autofocus aria-label="Close drawer">
                ✕
              </button></ds-button
            >
          </header>
          <p class="mt-3 text-muted">Extra context without leaving your workspace.</p>
          <dl class="mt-8 grid gap-6">
            <div>
              <dt class="text-muted">Working directory</dt>
              <dd class="font-mono">~/dev/fathom</dd>
            </div>
            <div>
              <dt class="text-muted">Branch</dt>
              <dd class="font-mono">main</dd>
            </div>
            <div>
              <dt class="text-muted">Changes</dt>
              <dd>3 files ready for review</dd>
            </div>
          </dl>
        </div>
        <edge-resizer edge="left"></edge-resizer>
      </dialog>
    </ds-drawer>
  `,
}));

drawerExamples.push({
  name: "Push content",
  markup: html`
    <ds-drawer mode="push" class="border border-line rounded-lg">
      <div data-content class="p-4">
        ${background}
        <ds-button
          ><button type="button" data-open aria-expanded="false" aria-controls="push-panel">
            Toggle drawer
          </button></ds-button
        >
        <label class="mt-6 block"
          >Session name<input
            class="mt-2 block w-full rounded-control border border-line bg-canvas p-2"
            value="Review changes"
        /></label>
      </div>
      <aside
        id="push-panel"
        class="border-l border-line"
        data-panel
        inert
        aria-labelledby="push-title"
      >
        <div data-drawer-scroll>
          <div class="h-full bg-surface p-4 wrap-anywhere">
            <header class="flex flex-wrap items-center justify-between gap-3">
              <h2 id="push-title" class="text-xl font-semibold">Session details</h2>
              <ds-button variant="quiet"
                ><button type="button" data-close aria-label="Close drawer">✕</button></ds-button
              >
            </header>
            <p class="mt-4 text-muted">
              The workspace stays usable. Try editing the session name while this panel is open.
            </p>
            <p class="mt-6">3 files ready for review</p>
          </div>
        </div>
        <edge-resizer edge="left"></edge-resizer>
      </aside>
    </ds-drawer>
  `,
});
