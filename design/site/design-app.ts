import { render } from "lit";

import { selectNavigation } from "./navigation.ts";
import { routePage } from "./route-page.ts";
import { viewerRoute } from "./viewer-route.ts";
import { viewerShell } from "./viewer-shell.ts";
import { ViewerSidebar } from "./viewer-sidebar.ts";
import { setupViewerTheme } from "./viewer-theme.ts";

class DesignApp extends HTMLElement {
  private events?: AbortController;
  private sidebar?: ViewerSidebar;

  connectedCallback() {
    this.events?.abort();
    this.events = new AbortController();
    const { signal } = this.events;
    render(viewerShell(), this);
    this.sidebar = new ViewerSidebar(this, signal);
    setupViewerTheme(this, signal);
    this.querySelector('a[href="#content"]')!.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        this.querySelector<HTMLElement>("main")!.focus();
      },
      { signal },
    );
    globalThis.addEventListener("hashchange", () => this.renderRoute(true), {
      signal,
    });
    this.renderRoute();
  }

  disconnectedCallback() {
    this.events?.abort();
  }

  private renderRoute(focus = false) {
    const path = location.hash.slice(1) || "/";
    const route = viewerRoute(path);
    render(routePage(route), this.querySelector<HTMLElement>("[data-content]")!);
    document.title = `${route.title} — Fathom`;
    selectNavigation(this, path);
    if (focus) {
      if (matchMedia("(max-width: 48rem)").matches) {
        this.sidebar!.setDrawer(true);
      }
      this.querySelector<HTMLElement>("main")!.focus({ preventScroll: true });
      globalThis.scrollTo(0, 0);
    }
  }
}

customElements.define("design-app", DesignApp);
