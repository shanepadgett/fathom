import { components, type DesignEntry, screens } from "../navigation.ts";

const navLinkClass =
  "flex min-h-10 items-center rounded-control px-3 text-muted hover:text-ink aria-[current=page]:bg-canvas aria-[current=page]:font-medium aria-[current=page]:text-ink";

class DesignApp extends HTMLElement {
  private events?: AbortController;

  connectedCallback() {
    this.events?.abort();
    this.events = new AbortController();
    const { signal } = this.events;
    this.innerHTML = `
      <a class="fixed top-[-5rem] left-4 z-30 bg-canvas p-3 focus:top-4" href="#content">Skip to content</a>
      <div data-shell class="min-h-dvh">
        <aside id="design-drawer" data-drawer class="fixed inset-y-0 left-0 z-20 flex w-60 flex-col overflow-y-auto border-r border-line bg-surface p-6" aria-label="Design navigation">
          <div data-brand class="mb-12 flex items-center justify-between text-base font-medium tracking-tight">
            <a href="#/">Fathom</a>
            <ds-button variant="quiet"><button type="button" data-drawer-toggle aria-label="Close navigation" aria-controls="design-drawer" aria-expanded="true">←</button></ds-button>
          </div>
          <nav data-nav class="grid gap-1" aria-label="Design">
            <a class="${navLinkClass}" href="#/">Home</a>
            <a class="${navLinkClass}" href="#/tokens">Tokens</a>
            ${this.navGroup("Components", "components", components)}
            ${this.navGroup("Screens", "screens", screens)}
          </nav>
          <div class="mt-auto pt-12">
            <ds-button variant="secondary" class="block w-full [&_button]:w-full [&_button]:justify-between"><button type="button" data-theme-toggle aria-pressed="false">Dark mode <span aria-hidden="true">◐</span></button></ds-button>
          </div>
        </aside>
        <ds-button variant="secondary" data-drawer-open class="fixed top-4 left-4 z-10" hidden><button type="button" data-drawer-toggle aria-label="Open navigation" aria-controls="design-drawer" aria-expanded="false">☰</button></ds-button>
        <main id="content" data-main class="min-h-dvh p-12 px-[clamp(1.5rem,3vw,3rem)] pt-20 md:ml-60 md:pt-12" tabindex="-1"><div data-content class="mx-auto max-w-7xl"></div></main>
      </div>`;

    this.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-drawer-toggle]")) {
        const collapsed = this.querySelector<HTMLElement>("[data-drawer]")!
          .hidden;
        this.setDrawer(!collapsed, true);
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
    globalThis.addEventListener("hashchange", () => this.renderRoute(true), {
      signal,
    });
    this.setDrawer(matchMedia("(max-width: 48rem)").matches);
    this.updateTheme();
    this.renderRoute();
  }

  disconnectedCallback() {
    this.events?.abort();
  }

  private navGroup(name: string, path: string, entries: DesignEntry[]) {
    return `<details open data-group="${path}" class="group">
      <summary class="${navLinkClass} justify-between after:content-['›'] after:text-base group-open:after:rotate-90">${name}</summary>
      <div class="my-1 mb-3 ml-3 border-l border-line pl-2">${
      entries.length
        ? entries.map((entry) =>
          `<a class="${navLinkClass}" href="#/${path}/${entry.id}">${entry.name}</a>`
        ).join("")
        : '<p class="px-3 text-muted">No screens yet.</p>'
    }</div></details>`;
  }

  private setDrawer(collapsed: boolean, focus = false) {
    const drawer = this.querySelector<HTMLElement>("[data-drawer]")!;
    const main = this.querySelector<HTMLElement>("[data-main]")!;
    const openToggle = this.querySelector<HTMLElement>("[data-drawer-open]")!;
    drawer.hidden = collapsed;
    openToggle.hidden = !collapsed;
    main.classList.toggle("md:ml-60", !collapsed);
    for (const button of this.querySelectorAll("[data-drawer-toggle]")) {
      button.setAttribute("aria-expanded", String(!collapsed));
    }
    if (focus) {
      this.querySelector<HTMLButtonElement>(
        collapsed ? "[data-drawer-open] button" : "[data-brand] button",
      )!.focus();
    }
  }

  private updateTheme() {
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
        body = entry.examples.map((example) =>
          `<section class="grid grid-cols-1 items-center gap-3 border-t border-line py-8 md:grid-cols-[minmax(7rem,1fr)_3fr] md:gap-6">
            <h2 class="text-base text-muted">${example.name}</h2>
            <div>${example.markup}</div>
          </section>`
        ).join("") +
          (entry.examples.length
            ? `<div class="border-b border-line" aria-hidden="true"></div>`
            : "");
        this.querySelector<HTMLDetailsElement>(`[data-group="${group}"]`)!
          .open = true;
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
        <h1 class="text-title font-medium leading-[1.15] tracking-[-0.04em]">${title}</h1>
        ${description ? `<p class="mt-3 text-muted">${description}</p>` : ""}
      </header>
      ${body}`;
    document.title = `${title} — Fathom`;
    for (
      const link of this.querySelectorAll<HTMLAnchorElement>("[data-nav] a")
    ) {
      if (link.hash === `#${path}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
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
