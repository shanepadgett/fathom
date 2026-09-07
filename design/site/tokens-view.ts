/** The reference reads compiled tokens, including the active theme's aliases. */
class TokensView extends HTMLElement {
  private category = "Colors";
  private observer = new MutationObserver(() => this.render());

  connectedCallback() {
    this.render();
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    this.observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  disconnectedCallback() {
    this.observer.disconnect();
  }

  private render() {
    const names = new Set<string>();
    const collect = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (
          rule instanceof CSSStyleRule && rule.selectorText.includes(":root")
        ) {
          for (const name of rule.style) {
            if (name.startsWith("--") && !name.startsWith("--tw-")) {
              names.add(name);
            }
          }
        }
        if (rule instanceof CSSGroupingRule) collect(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        collect(sheet.cssRules);
      } catch (error) {
        // Google Fonts stylesheets are not readable across origins.
        if (
          !(error instanceof DOMException && error.name === "SecurityError")
        ) throw error;
      }
    }
    const styles = getComputedStyle(document.documentElement);
    const colorContext = document.createElement("canvas").getContext("2d")!;
    const activeControl = this.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.category
      : undefined;
    this.replaceChildren();
    this.className = "block text-base";

    const nav = document.createElement("nav");
    nav.className = "mb-6 flex gap-6 overflow-x-auto border-b border-line";
    nav.setAttribute("aria-label", "Token categories");
    this.append(nav);
    const panels = new Map<string, HTMLElement>();
    for (
      const [index, category] of [
        "Colors",
        "Typography",
        "Layout & effects",
        "Animation",
      ]
        .entries()
    ) {
      const panel = document.createElement("div");
      panel.id = `tokens-panel-${index}`;
      panel.hidden = category !== this.category;
      panels.set(category, panel);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category;
      button.dataset.category = category;
      button.className =
        "shrink-0 border-0 border-b-[3px] border-transparent bg-transparent px-0 py-3 whitespace-nowrap text-muted aria-[pressed=true]:border-current aria-[pressed=true]:font-semibold aria-[pressed=true]:text-action focus-visible:outline-offset-[-4px]";
      button.setAttribute("aria-controls", panel.id);
      button.setAttribute("aria-pressed", String(category === this.category));
      button.addEventListener("click", () => {
        this.category = category;
        for (const [name, element] of panels) {
          element.hidden = name !== category;
        }
        for (const control of nav.querySelectorAll("button")) {
          control.setAttribute("aria-pressed", String(control === button));
        }
      });
      nav.append(button);
      this.append(panel);
    }

    const sections = [
      {
        title: "Durations",
        category: "Animation",
        kind: "motion",
        prefix: "--motion-duration-",
        description:
          "Fast: feedback and exits. Normal: modals and accordions. Slow: drawer entrances. Reduced motion sets these to zero. Use duration-(--motion-duration-normal) in Tailwind.",
      },
      {
        title: "Easing",
        category: "Animation",
        kind: "motion",
        prefix: "--ease-",
        description:
          "Enter slows into place. Exit speeds away. Standard changes in place. Tailwind: ease-enter, ease-exit, ease-standard.",
      },
      {
        title: "Movement and scale",
        category: "Animation",
        kind: "motion",
        tokens: [...names].filter((name) =>
          name.startsWith("--motion-distance-") ||
          name.startsWith("--motion-scale-")
        ),
        description:
          "Small movement and subtle scale for modal entrances. Full-width drawer travel belongs to the component, not a distance token.",
      },
      {
        title: "Color scales",
        category: "Colors",
        kind: "palette",
        description:
          "Deep teal with neutral grays. Each column runs from 50 to 950.",
        tokens: [...names].filter((name) => /^--color-.+-\d+$/.test(name)),
      },
      {
        title: "Color roles",
        category: "Colors",
        kind: "roles",
        description:
          "The values used by components. These follow the light / dark switch.",
        tokens: [...names].filter((name) =>
          name.startsWith("--color-") && !/-\d+$/.test(name)
        ),
      },
      {
        title: "Font families",
        category: "Typography",
        kind: "family",
        prefix: "--font-",
        description: "Space Grotesk for UI and prose. Fragment Mono for code.",
      },
      {
        title: "Font sizes",
        category: "Typography",
        kind: "size",
        prefix: "--text-",
        description: "16px is the default. Only these samples change size.",
      },
      {
        title: "Font weights",
        category: "Typography",
        kind: "weight",
        prefix: "--font-weight-",
        description:
          "UI weights in Space Grotesk. Code uses Fragment Mono at 400.",
      },
      {
        title: "Line heights",
        category: "Typography",
        kind: "leading",
        prefix: "--leading-",
      },
      {
        title: "Letter spacing",
        category: "Typography",
        kind: "tracking",
        prefix: "--tracking-",
      },
      {
        title: "Spacing",
        category: "Layout & effects",
        kind: "spacing",
        prefix: "--spacing",
        description: "A 4px base unit. Bars show the actual distance.",
      },
      {
        title: "Radius",
        category: "Layout & effects",
        kind: "radius",
        prefix: "--radius-",
      },
      {
        title: "Shadows",
        category: "Layout & effects",
        kind: "shadow",
        prefix: "--shadow-",
      },
    ];

    for (const definition of sections) {
      const tokens = definition.tokens ??
        [...names].filter((name) =>
          name.startsWith(definition.prefix!) &&
          !(definition.kind === "family" && name.startsWith("--font-weight-"))
        );
      if (!tokens.length) continue;

      const section = document.createElement("section");
      section.className = "mb-8 last:mb-0";
      const header = document.createElement("header");
      header.className = "mb-4";
      const heading = document.createElement("h2");
      heading.className =
        "m-0 text-2xl font-semibold leading-tight tracking-tight";
      heading.textContent = definition.title;
      header.append(heading);
      if (definition.description) {
        const description = document.createElement("p");
        description.className = "mt-2 text-muted";
        description.textContent = definition.description;
        header.append(description);
      }
      section.append(header);

      const list = document.createElement("dl");
      list.className = definition.kind === "roles"
        ? "m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-2"
        : "m-0";
      section.append(list);
      panels.get(definition.category)!.append(section);

      const scales = new Map<string, HTMLElement>();
      for (const name of tokens) {
        const value = styles.getPropertyValue(name).trim();
        const row = document.createElement("div");
        row.className = definition.kind === "family"
          ? "grid grid-cols-1 items-center gap-2 border-t border-line py-4 md:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)] md:gap-4"
          : "grid min-h-12 grid-cols-1 items-center gap-2 border-t border-line py-2 md:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)] md:gap-4";
        const term = document.createElement("dt");
        term.className = "m-0 wrap-anywhere text-base";
        term.textContent = name;
        const detail = document.createElement("dd");
        detail.className =
          "m-0 grid min-w-0 grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto]";
        const sample = document.createElement("span");
        sample.className = "wrap-anywhere whitespace-pre-line text-base";
        sample.setAttribute("aria-hidden", "true");
        const code = document.createElement("code");
        code.className =
          "max-w-[22ch] wrap-anywhere text-right text-base text-muted";
        code.textContent = value;
        row.append(term, detail);

        if (name.startsWith("--color-")) {
          row.className =
            "flex min-h-11 items-center justify-between gap-2 border-0 px-3 py-2";
          if (definition.kind === "roles") {
            row.classList.add("rounded-sm");
          }
          row.style.background = `var(${name})`;
          colorContext.fillStyle = value;
          const hex = colorContext.fillStyle;
          const channels = hex.slice(1).match(/../g)!.map((channel) => {
            const c = parseInt(channel, 16) / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 +
            channels[2] * 0.0722;
          row.style.color = luminance > 0.179 ? "#000000" : "#ffffff";
          code.className =
            "whitespace-nowrap text-right text-base text-inherit";
          code.textContent = hex;
          detail.className = "m-0";
          detail.append(code);
          if (definition.kind === "palette") {
            const family = name.match(/^--color-(.+)-\d+$/)![1];
            let column = scales.get(family);
            if (!column) {
              const group = document.createElement("div");
              const title = document.createElement("h3");
              title.className = "mb-2 capitalize text-base font-medium";
              title.textContent = family;
              column = document.createElement("dl");
              column.className = "m-0 overflow-hidden rounded-md";
              group.append(title, column);
              section.append(group);
              scales.set(family, column);
            }
            term.textContent = name.replace("--color-", "");
            term.title = name;
            term.setAttribute("aria-label", name);
            column.append(row);
          } else list.append(row);
          continue;
        }

        switch (definition.kind) {
          case "motion": {
            const dot = document.createElement("span");
            dot.className = "block h-4 w-4 rounded-sm bg-action";
            sample.append(dot);
            if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
              const current = getComputedStyle(document.documentElement);
              const duration = current.getPropertyValue(
                name.startsWith("--motion-duration-")
                  ? name
                  : "--motion-duration-slow",
              ).trim();
              const from = name.startsWith("--motion-scale-")
                ? `scale(var(${name}))`
                : "translateX(0)";
              const to = name.startsWith("--motion-scale-")
                ? "scale(1)"
                : `translateX(var(${
                  name.startsWith("--motion-distance-") ? name : "--spacing-16"
                }))`;
              dot.animate([{ transform: from }, { transform: to }], {
                duration: parseFloat(duration) *
                  (duration.endsWith("ms") ? 1 : 1000),
                easing: current.getPropertyValue(
                  name.startsWith("--ease-") ? name : "--ease-standard",
                ).trim(),
                iterations: Infinity,
                direction: "alternate",
              });
            }
            break;
          }
          case "family":
            sample.style.fontFamily = `var(${name})`;
            sample.textContent = name === "--font-mono"
              ? "const session = await agent.run();\n0O 1lI · {} [] => !=="
              : "A clear view of the work.\nPlan, build, and review with Fathom.";
            code.className =
              "max-w-[22ch] wrap-anywhere text-right font-sans text-base text-muted md:text-right max-md:text-left";
            code.textContent = value.split(",")[0].replaceAll('"', "");
            detail.className =
              "m-0 grid min-w-0 grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto]";
            break;
          case "size":
            sample.textContent = "A clear view of the work";
            sample.style.fontSize = `var(${name})`;
            break;
          case "weight":
            sample.textContent = "A clear view of the work";
            sample.style.fontWeight = `var(${name})`;
            break;
          case "leading":
            sample.textContent =
              "Read the code. Trace the cause.\nKeep the next step clear.";
            sample.style.lineHeight = `var(${name})`;
            break;
          case "tracking":
            sample.textContent = "A clear view of the work";
            sample.style.letterSpacing = `var(${name})`;
            break;
          case "spacing":
            sample.className = "h-3 border-l border-action bg-action";
            sample.style.width = `var(${name})`;
            break;
          case "radius":
            sample.className = "h-8 w-16 border border-action bg-surface";
            sample.style.borderRadius = `var(${name})`;
            break;
          case "shadow":
            sample.className =
              "my-2 h-8 w-20 rounded-sm border border-line bg-surface";
            sample.style.boxShadow = `var(${name})`;
            break;
        }
        detail.append(sample, code);
        list.append(row);
      }
      if (definition.kind === "palette") {
        list.remove();
        const strip = document.createElement("div");
        strip.className =
          "grid grid-cols-[repeat(5,minmax(13rem,1fr))] gap-2 overflow-x-auto pb-2";
        strip.tabIndex = 0;
        strip.setAttribute("role", "region");
        strip.setAttribute(
          "aria-label",
          "Color scales, scroll horizontally to compare",
        );
        strip.append(...section.querySelectorAll(":scope > div"));
        section.append(strip);
      }
    }
    if (activeControl) {
      for (const button of nav.querySelectorAll("button")) {
        if (button.dataset.category === activeControl) {
          button.focus({ preventScroll: true });
        }
      }
    }
  }
}

customElements.define("tokens-view", TokensView);
