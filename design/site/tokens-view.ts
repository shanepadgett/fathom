import { html } from "lit";

import { DesignElement } from "../foundation/design-element.ts";
import { tokenNames } from "./token-discovery.ts";
import { section } from "./token-samples.ts";
import { categories, tokenSections } from "./token-sections.ts";

class TokensView extends DesignElement {
  static override properties = { category: { state: true } };

  declare private category: string;

  private observer = new MutationObserver(() => this.requestUpdate());

  private motion = matchMedia("(prefers-reduced-motion: reduce)");

  private refresh = () => this.requestUpdate();

  constructor() {
    super();
    this.category = "Colors";
  }

  override connectedCallback() {
    super.connectedCallback();
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    this.observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    this.motion.addEventListener("change", this.refresh);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.observer.disconnect();
    this.motion.removeEventListener("change", this.refresh);
    for (const animation of this.getAnimations({ subtree: true })) {
      animation.cancel();
    }
  }

  override updated() {
    for (
      const dot of this.querySelectorAll<HTMLElement>("[data-motion-token]")
    ) {
      for (const animation of dot.getAnimations()) animation.cancel();
      if (this.motion.matches) continue;
      const name = dot.dataset.motionToken!;
      const current = getComputedStyle(document.documentElement);
      const duration = current
        .getPropertyValue(
          name.startsWith("--motion-duration-")
            ? name
            : "--motion-duration-slow",
        )
        .trim();
      const from = name.startsWith("--motion-scale-")
        ? `scale(var(${name}))`
        : "translateX(0)";
      const to = name.startsWith("--motion-scale-")
        ? "scale(1)"
        : `translateX(var(${
          name.startsWith("--motion-distance-") ? name : "--spacing-16"
        }))`;
      dot.animate([{ transform: from }, { transform: to }], {
        duration: parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000),
        easing: current
          .getPropertyValue(
            name.startsWith("--ease-") ? name : "--ease-standard",
          )
          .trim(),
        iterations: Infinity,
        direction: "alternate",
      });
    }
  }

  override render() {
    const names = tokenNames();
    const styles = getComputedStyle(document.documentElement);
    const sections = tokenSections(names);
    return html`
      <div class="block text-base">
        <nav
          class="mb-6 flex gap-6 overflow-x-auto border-b border-line"
          aria-label="Token categories"
        >
          ${categories.map(
            (category, index) =>
              html`
                <button
                  type="button"
                  data-category=${category}
                  aria-controls=${`tokens-panel-${index}`}
                  aria-pressed=${category === this.category}
                  @click=${() => {
                    this.category = category;
                  }}
                  class="shrink-0 border-0 border-b-3 border-transparent bg-transparent px-0 py-3 whitespace-nowrap text-muted aria-[pressed=true]:border-current aria-[pressed=true]:font-semibold aria-[pressed=true]:text-action focus-visible:-outline-offset-4"
                >
                  ${category}
                </button>
              `,
          )}
        </nav>
        ${categories.map(
          (category, index) =>
            html`
              <div id=${`tokens-panel-${index}`} ?hidden=${category !==
                this.category}>
                ${sections
                  .filter((definition) => definition.category === category)
                  .map((definition) => section(definition, [...names], styles))}
              </div>
            `,
        )}
      </div>
    `;
  }
}

customElements.define("tokens-view", TokensView);
