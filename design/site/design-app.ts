import { sidebarResizeBounds } from "../components/edge-resizer.ts";
import { components, screens } from "../navigation.ts";
import { icon } from "../primitives/content.ts";
import { viewerNavigation } from "./navigation.ts";

const DEFAULT_SIDEBAR_WIDTH = 240;

class DesignApp extends HTMLElement {
  private events?: AbortController;
  private sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
  private isCollapsed = false;

  connectedCallback() {
    this.events?.abort();
    this.events = new AbortController();
    const { signal } = this.events;

    try {
      const saved = Number(
        localStorage.getItem("fathom-design-sidebar-width"),
      );
      if (
        Number.isFinite(saved) && saved >= sidebarResizeBounds.min &&
        saved <= sidebarResizeBounds.max
      ) {
        this.sidebarWidth = saved;
      }
    } catch { /* Optional persistence. */ }

    this.innerHTML = `
      <a class="fixed -top-20 left-4 z-30 bg-canvas p-3 focus:top-4" href="#content">Skip to content</a>
      <div data-shell class="min-h-dvh">
        <aside id="design-drawer" data-drawer class="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-line bg-surface" aria-label="Design navigation">
          <div data-brand class="flex h-20 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
            <a href="#/" class="min-w-0"><span class="block text-base font-medium tracking-tight">Fathom<span class="text-action">.</span></span><span class="block text-micro text-muted">Design reference</span></a>
            <ds-button variant="quiet" size="small" icon-only><button type="button" data-drawer-toggle aria-label="Close navigation" aria-controls="design-drawer" aria-expanded="true">${
      icon("sidebar-simple")
    }</button></ds-button>
          </div>
          <nav data-nav class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4" aria-label="Design">${viewerNavigation()}</nav>
          <div class="shrink-0 border-t border-line p-3">
            <ds-button variant="quiet" size="compact" class="block w-full [&_button]:w-full [&_button]:justify-between"><button type="button" data-theme-toggle aria-pressed="false"><span data-theme-label>Dark appearance</span><span data-theme-state class="text-micro text-muted">Off</span></button></ds-button>
          </div>
          <edge-resizer data-drawer-resizer edge="right"></edge-resizer>
        </aside>
        <ds-button variant="secondary" data-drawer-open class="viewer-edge-tab fixed left-0 top-1/2 z-30" hidden><button type="button" data-drawer-toggle aria-label="Open navigation" aria-controls="design-drawer" aria-expanded="false">${
      icon("sidebar-simple")
    }</button></ds-button>
        <main id="content" data-main class="min-h-dvh p-12 px-page-gutter pt-20 md:ml-60 md:pt-12" tabindex="-1"><div data-content class="mx-auto max-w-7xl"></div></main>
      </div>`;

    this.addEventListener("edge-resize", (event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.matches("[data-drawer-resizer]")
      ) return;
      this.sidebarWidth = (event as CustomEvent<number>).detail;
      this.updateLayout();
      try {
        localStorage.setItem(
          "fathom-design-sidebar-width",
          String(this.sidebarWidth),
        );
      } catch { /* Optional persistence. */ }
    }, { signal });

    this.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-drawer-toggle]")) {
        const collapsed = this.querySelector<HTMLElement>("[data-drawer]")!
          .hidden;
        this.setDrawer(!collapsed, true, (event as MouseEvent).detail === 0);
      }
      if (target.closest("[data-theme-toggle]")) {
        const theme = document.documentElement.dataset.theme === "dark"
          ? "light"
          : "dark";
        document.documentElement.dataset.theme = theme;
        try {
          localStorage.setItem("fathom-design-theme", theme);
        } catch { /* Optional persistence. */ }
        this.updateTheme();
      }
      if (target.closest('a[href="#content"]')) {
        event.preventDefault();
        this.querySelector<HTMLElement>("main")!.focus();
      }
    }, { signal });

    this.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        this.querySelector("[data-drawer]")!.contains(document.activeElement)
      ) {
        this.setDrawer(true, true);
      }
    }, { signal });

    globalThis.addEventListener("pointermove", (event) => {
      if (!this.isCollapsed || event.pointerType === "touch") return;
      const tab = this.querySelector<HTMLElement>("[data-drawer-open]")!;
      const nearEdge = event.clientX <= tab.offsetWidth * 2;
      const entering = nearEdge && !tab.hasAttribute("data-revealed");
      if (entering) tab.setAttribute("data-positioning", "");
      if (nearEdge) {
        // Pointer-derived placement is clamped to the viewport. This runtime
        // coordinate is intentionally not a fixed design dimension.
        const half = tab.offsetHeight / 2;
        tab.style.top = `${
          Math.max(half, Math.min(innerHeight - half, event.clientY))
        }px`;
      }
      if (entering) {
        // Commit the arrival position without vertical motion before revealing.
        tab.getBoundingClientRect();
        tab.removeAttribute("data-positioning");
      }
      tab.toggleAttribute("data-revealed", nearEdge);
    }, { signal });
    const hideEdgeTab = () => {
      this.querySelector("[data-drawer-open]")?.removeAttribute(
        "data-revealed",
      );
    };
    document.documentElement.addEventListener("pointerleave", hideEdgeTab, {
      signal,
    });
    globalThis.addEventListener("blur", hideEdgeTab, { signal });
    globalThis.addEventListener("resize", () => {
      const tab = this.querySelector<HTMLElement>("[data-drawer-open]")!;
      tab.style.top = "";
      hideEdgeTab();
      this.updateLayout();
    }, { signal });

    globalThis.addEventListener("hashchange", () => this.renderRoute(true), {
      signal,
    });
    this.setDrawer(matchMedia("(max-width: 48rem)").matches);
    this.updateTheme();
    this.renderRoute();
  }

  disconnectedCallback() {
    this.events?.abort();
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  private updateLayout() {
    const isDesktop = matchMedia("(min-width: 48rem)").matches;
    const drawer = this.querySelector<HTMLElement>("[data-drawer]");
    const main = this.querySelector<HTMLElement>("[data-main]");
    if (drawer) {
      drawer.style.width = `${this.sidebarWidth}px`;
    }
    if (main) {
      main.style.marginLeft = !this.isCollapsed && isDesktop
        ? `${this.sidebarWidth}px`
        : "";
    }
  }

  private setDrawer(collapsed: boolean, focus = false, keyboard = true) {
    this.isCollapsed = collapsed;
    const drawer = this.querySelector<HTMLElement>("[data-drawer]")!;
    const main = this.querySelector<HTMLElement>("[data-main]")!;
    const openToggle = this.querySelector<HTMLElement>("[data-drawer-open]")!;
    drawer.hidden = collapsed;
    openToggle.hidden = !collapsed;
    openToggle.removeAttribute("data-revealed");
    openToggle.style.top = "";
    main.classList.toggle("md:ml-60", !collapsed);
    this.updateLayout();
    for (const button of this.querySelectorAll("[data-drawer-toggle]")) {
      button.setAttribute("aria-expanded", String(!collapsed));
    }
    if (focus) {
      this.querySelector<HTMLElement>(
        collapsed
          ? keyboard ? "[data-drawer-open] button" : "main"
          : "[data-brand] button",
      )!.focus({ preventScroll: true });
    }
  }

  private updateTheme() {
    this.querySelector("[data-theme-state]")!.textContent =
      document.documentElement.dataset.theme === "dark" ? "On" : "Off";
    this.querySelector("[data-theme-toggle]")!.setAttribute(
      "aria-pressed",
      String(document.documentElement.dataset.theme === "dark"),
    );
  }

  private renderRoute(focus = false) {
    const path = location.hash.slice(1) || "/";
    const content = this.querySelector<HTMLElement>("[data-content]")!;
    let title = "Design";
    let description = "";
    let body = "";
    let screenActions = "";
    if (path === "/") {
      body = `<div>${this.indexLink("#/tokens", "Tokens")}${
        this.indexLink("#/components", "Components")
      }${this.indexLink("#/screens", "Screens")}</div>`;
    } else if (path === "/tokens") {
      title = "Tokens";
      description = "Deep teal · Space Grotesk + Fragment Mono";
      body = "<tokens-view></tokens-view>";
    } else {
      const group = path.split("/")[1];
      const entries = group === "components"
        ? components
        : group === "screens"
        ? screens
        : undefined;
      const entry = entries?.find((item) => path === `/${group}/${item.id}`);
      if (entry) {
        title = entry.name;
        description = entry.description;
        if (group === "screens") {
          screenActions = entry.examples.map((example, index) =>
            `<a class="ds-button shrink-0" href="./index.html?screen=${entry.id}&example=${index}" aria-label="Screen only: ${example.name}">${
              entry.examples.length > 1 ? example.name + " · " : ""
            }Screen only ↗</a>`
          ).join("");
        }
        body = entry.examples.map((example, index) =>
          `<section class="${
            group === "screens"
              ? "grid grid-cols-1 gap-3 py-4"
              : "grid grid-cols-1 items-center gap-3 border-t border-line py-8 md:grid-cols-component-example md:gap-6"
          }">
            <h2 class="text-base text-muted">${example.name}</h2>
            <div class="relative min-w-0">${
            entry.id === "modal" || entry.id === "drawer"
              ? `<iframe title="${entry.name}: ${example.name}" src="./index.html?preview=${entry.id}&example=${index}" class="block h-component-preview w-full rounded-lg border border-line bg-canvas"></iframe>`
              : example.markup
          }</div>
          </section>`
        ).join("") +
          (entry.examples.length
            ? `<div class="border-b border-line" aria-hidden="true"></div>`
            : "");
      } else if (entries && path === `/${group}`) {
        title = group === "components" ? "Components" : "Screens";
        body = entries.length
          ? `<div>${
            entries.map((item) =>
              this.indexLink(`#/${group}/${item.id}`, item.name)
            ).join("")
          }</div>`
          : '<p class="text-muted">No screens yet.</p>';
      } else {
        title = "Not found";
        body = '<a href="#/" class="underline">Home</a>';
      }
    }
    content.innerHTML = `
      <header class="mb-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-title font-medium leading-title tracking-title">${title}</h1>
          ${
      screenActions
        ? `<div class="flex flex-wrap gap-2">${screenActions}</div>`
        : ""
    }
        </div>
        ${description ? `<p class="mt-3 text-muted">${description}</p>` : ""}
      </header>
      ${body}`;
    document.title = `${title} — Fathom`;
    for (
      const link of this.querySelectorAll<HTMLAnchorElement>("[data-nav] a")
    ) {
      if (link.hash === `#${path}`) {
        link.setAttribute("aria-current", "page");
        let group = link.closest("details");
        while (group) {
          group.open = true;
          group = group.parentElement?.closest("details") ?? null;
        }
      } else link.removeAttribute("aria-current");
    }
    if (focus) {
      if (matchMedia("(max-width: 48rem)").matches) this.setDrawer(true);
      this.querySelector<HTMLElement>("main")!.focus({ preventScroll: true });
      globalThis.scrollTo(0, 0);
    }
  }

  private indexLink(href: string, label: string) {
    return `<a class="flex items-baseline justify-between border-b border-line py-6 text-base first:border-t hover:text-muted" href="${href}">${label}<span aria-hidden="true">↗</span></a>`;
  }
}

customElements.define("design-app", DesignApp);
