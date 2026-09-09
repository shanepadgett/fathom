import { html } from "lit";

import "../components/button.ts";
import "../components/edge-resizer.ts";
import { icon } from "../primitives/icon.ts";
import { viewerNavigation } from "./navigation.ts";
import { viewerSidebarBounds } from "./viewer-sidebar.ts";

export const viewerShell = () => html`
  <a class="fixed -top-20 left-4 z-30 bg-canvas p-3 focus:top-4" href="#content">Skip to content</a>
  <div data-shell class="min-h-dvh">
    <aside
      id="design-drawer"
      data-drawer
      class="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-line bg-surface"
      aria-label="Design navigation"
    >
      <div
        data-brand
        class="flex h-20 shrink-0 items-center justify-between gap-2 border-b border-line px-4"
      >
        <a href="#/" class="min-w-0"
          ><span class="block text-sm font-medium tracking-tight">Design reference</span></a
        >
        <ds-button variant="quiet" size="small" icon-only
          ><button
            type="button"
            data-drawer-toggle
            aria-label="Close navigation"
            aria-controls="design-drawer"
            aria-expanded="true"
          >
            ${icon("sidebar-simple")}
          </button></ds-button
        >
      </div>
      <nav
        data-nav
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        aria-label="Design"
      >
        ${viewerNavigation()}
      </nav>
      <div class="shrink-0 border-t border-line p-3">
        <ds-button
          variant="quiet"
          size="compact"
          class="block w-full [&_button]:w-full [&_button]:justify-between"
          ><button type="button" data-theme-toggle aria-pressed="false">
            <span data-theme-label>Dark appearance</span
            ><span data-theme-state class="text-micro text-muted">Off</span>
          </button></ds-button
        >
      </div>
      <edge-resizer data-drawer-resizer edge="right" .bounds=${viewerSidebarBounds}></edge-resizer>
    </aside>
    <ds-button
      variant="secondary"
      data-drawer-open
      class="viewer-edge-tab fixed left-0 top-1/2 z-30"
      hidden
      ><button
        type="button"
        data-drawer-toggle
        aria-label="Open navigation"
        aria-controls="design-drawer"
        aria-expanded="false"
      >
        ${icon("sidebar-simple")}
      </button></ds-button
    >
    <main
      id="content"
      data-main
      class="min-h-dvh p-12 px-viewer-page-gutter pt-20 md:ml-60 md:pt-12 has-[[data-overview]]:p-0"
      tabindex="-1"
    >
      <div data-content class="mx-auto max-w-7xl has-[[data-overview]]:max-w-none"></div>
    </main>
  </div>
`;
