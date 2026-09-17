import type { TokenSection } from "./token-sections.ts";

import { html, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";

const colorContext = document.createElement("canvas").getContext("2d")!;

function colorRow(name: string, value: string, palette: boolean) {
  colorContext.fillStyle = value;
  const hex = colorContext.fillStyle;
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const c = parseInt(channel, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;

  return html`
    <div
      class="flex min-h-11 items-center justify-between gap-2 border-0 px-3 py-2 ${
        palette ? "" : "rounded-sm"
      }"
      style=${styleMap({
        background: `var(${name})`,
        color: luminance > 0.179 ? "#000000" : "#ffffff",
      })}
    >
      <dt
        class="m-0 wrap-anywhere text-base"
        title=${palette ? name : nothing}
        aria-label=${palette ? name : nothing}
      >
        ${palette ? name.replace("--color-", "") : name}
      </dt>
      <dd class="m-0">
        <code class="whitespace-nowrap text-right text-base text-inherit">${hex}</code>
      </dd>
    </div>
  `;
}

function sample(kind: string, name: string) {
  const variable = `var(${name})`;
  const phrase = "A clear view of the work";
  let content: string | ReturnType<typeof html> = "";
  let classes = "wrap-anywhere whitespace-pre-line text-base";
  const styles: Record<string, string> = {};

  switch (kind) {
    case "motion":
      content = html`
        <span class="block h-4 w-4 rounded-sm bg-action" data-motion-token=${name}></span>
      `;
      break;
    case "family":
      styles.fontFamily = variable;
      content =
        name === "--font-mono"
          ? "const session = await agent.run();\n0O 1lI · {} [] => !=="
          : "A clear view of the work.\nPlan, build, and review with Fathom.";
      break;
    case "size":
      content = phrase;
      styles.fontSize = variable;
      break;
    case "weight":
      content = phrase;
      styles.fontWeight = variable;
      break;
    case "leading":
      content = "Read the code. Trace the cause.\nKeep the next step clear.";
      styles.lineHeight = variable;
      break;
    case "tracking":
      content = phrase;
      styles.letterSpacing = variable;
      break;
    case "spacing":
      classes = "h-3 border-l border-action bg-action";
      styles.width = variable;
      break;
    case "radius":
      classes = "h-8 w-16 border border-action bg-surface";
      styles.borderRadius = variable;
      break;
    case "shadow":
      classes = "my-2 h-8 w-20 rounded-sm border border-line bg-surface";
      styles.boxShadow = variable;
      break;
  }
  return html`
    <span class=${classes} style=${styleMap(styles)} aria-hidden="true">${content}</span>
  `;
}

function tokenRow(definition: TokenSection, name: string, value: string) {
  if (name.startsWith("--color-")) return colorRow(name, value, false);
  const family = definition.kind === "family";
  return html`
    <div
      class=${
        family
          ? "grid grid-cols-1 items-center gap-2 border-t border-line py-4 md:grid-cols-token-row md:gap-4"
          : "grid min-h-12 grid-cols-1 items-center gap-2 border-t border-line py-2 md:grid-cols-token-row md:gap-4"
      }
    >
      <dt class="m-0 wrap-anywhere text-base">${name}</dt>
      <dd class="m-0 grid min-w-0 grid-cols-1 items-center gap-4 md:grid-cols-token-detail">
        ${sample(definition.kind, name)}
        <code
          class=${
            family
              ? "max-w-viewer-token-value wrap-anywhere text-right font-sans text-base text-muted md:text-right max-md:text-left"
              : "max-w-viewer-token-value wrap-anywhere text-right text-base text-muted"
          }
        >
          ${family ? value.split(",")[0].replaceAll('"', "") : value}
        </code>
      </dd>
    </div>
  `;
}

export function section(definition: TokenSection, names: string[], styles: CSSStyleDeclaration) {
  const tokens =
    definition.tokens ??
    names.filter(
      (name) =>
        name.startsWith(definition.prefix!) &&
        !(definition.kind === "family" && name.startsWith("--font-weight-")),
    );
  if (!tokens.length) return nothing;
  const palettes = Map.groupBy(tokens, (name) => name.replace(/^--color-(.+)-\d+$/, "$1"));

  return html`
    <section class="mb-8 last:mb-0">
      <header class="mb-4">
        <h2 class="m-0 text-2xl font-semibold leading-tight tracking-tight">${definition.title}</h2>
        ${
          definition.description
            ? html`<p class="mt-2 text-muted">${definition.description}</p>`
            : nothing
        }
      </header>
      ${
        definition.kind === "palette"
          ? html`
              <div
                class="grid grid-cols-token-palette gap-2 overflow-x-auto pb-2"
                tabindex="0"
                role="region"
                aria-label="Color scales, scroll horizontally to compare"
              >
                ${[...palettes].map(
                  ([family, colors]) => html`
                    <div>
                      <h3 class="mb-2 capitalize text-base font-medium">${family}</h3>
                      <dl class="m-0 overflow-hidden rounded-md">
                        ${colors.map((name) =>
                          colorRow(name, styles.getPropertyValue(name).trim(), true),
                        )}
                      </dl>
                    </div>
                  `,
                )}
              </div>
            `
          : html`
              <dl
                class=${
                  definition.kind === "roles" ? "m-0 grid grid-cols-token-roles gap-2" : "m-0"
                }
              >
                ${tokens.map((name) =>
                  tokenRow(definition, name, styles.getPropertyValue(name).trim()),
                )}
              </dl>
            `
      }
    </section>
  `;
}
