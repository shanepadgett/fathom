import type { ViewerRoute } from "./viewer-route.ts";

import { html, type TemplateResult } from "lit";

import { icon } from "../primitives/icon.ts";
import "../primitives/fathom-wordmark.ts";
import "./tokens-view.ts";

const homeImage = new URL("./assets/home-depth.jpg", import.meta.url).href;
const homeLightImage = new URL("./assets/home-depth-light.jpg", import.meta.url).href;

function indexLink(href: string, label: string) {
  return html`
    <a
      class="flex items-baseline justify-between border-b border-line py-6 text-base first:border-t hover:text-muted"
      href="${href}"
      >${label}<span aria-hidden="true">↗</span></a
    >
  `;
}

export function routePage(route: ViewerRoute) {
  const { title, description } = route;
  let body: TemplateResult | TemplateResult[] = html``;
  let screenActions: TemplateResult[] = [];
  if (route.kind === "home") {
    body = html`
      <div data-overview class="relative isolate overflow-hidden bg-canvas">
        <img
          src=${homeLightImage}
          alt=""
          class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-right blur-workspace dark:hidden"
        />
        <img
          src=${homeImage}
          alt=""
          class="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full object-cover object-right opacity-70 blur-workspace dark:block"
        />
        <div
          class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-transparent to-canvas to-85%"
          aria-hidden="true"
        ></div>
        <section class="px-viewer-page-gutter pt-16 pb-12" aria-labelledby="home-introduction">
          <div class="relative mx-auto max-w-transcript">
            <h1 class="mb-12 text-center text-wordmark leading-tight">
              <fathom-wordmark></fathom-wordmark>
            </h1>
            <h2
              id="home-introduction"
              class="text-title font-medium leading-title tracking-title text-balance"
            >
              A coding harness that fits your work.
            </h2>
            <p class="mt-6 leading-relaxed">
              <span class="underline decoration-action underline-offset-4"
                >Everything is a plugin.</span
              >
              That includes the editor and agent views, connections to model providers, and the
              tools an agent can use. You can replace any of these with your own plugin or leave out
              the ones your team doesn’t need.
            </p>
            <p class="mt-4 leading-relaxed">
              If your work happens through the agent, remove the editor. If your team needs to read
              the code as it changes, keep the editor and remove the agent-only view. A team working
              through a queue of support requests may need a different workspace from a team
              reviewing code.
            </p>
            <p class="mt-4 leading-relaxed">
              Replace conversation compaction to choose what the agent remembers. Or add a tool that
              connects it to your internal ticket system.
            </p>
          </div>
        </section>

        <section
          class="mx-auto max-w-7xl px-viewer-page-gutter pt-6 pb-12"
          aria-label="Design reference"
        >
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <a
              href="#/tokens"
              class="group flex min-w-0 flex-col rounded-lg border border-line bg-surface p-6 hover:border-action hover:bg-action/5"
            >
              <div class="flex h-24 items-center gap-2" aria-hidden="true">
                <span class="h-10 w-10 rounded-full bg-action"></span>
                <span class="h-10 w-10 rounded-full bg-muted"></span>
                <span class="h-10 w-10 rounded-full border border-line bg-canvas"></span>
              </div>
              <div class="mt-6 flex items-center justify-between gap-2">
                <h3 class="text-xl font-medium">Tokens</h3>
                <span class="text-action" aria-hidden="true">↗</span>
              </div>
              <p class="mt-3 text-muted leading-relaxed">
                Color, type, spacing, and motion values used throughout the interface.
              </p>
            </a>

            <a
              href="#/components"
              class="group flex min-w-0 flex-col rounded-lg border border-line bg-surface p-6 hover:border-action hover:bg-action/5"
            >
              <div class="flex h-24 items-center gap-2" aria-hidden="true">
                <span
                  class="flex h-10 w-10 items-center justify-center rounded-control border border-line bg-canvas text-action"
                  >${icon("plus", "large")}</span
                >
                <span
                  class="flex h-10 flex-1 items-center gap-2 rounded-control border border-line bg-canvas px-3"
                >
                  <span class="h-2 w-2 shrink-0 rounded-full bg-action"></span>
                  <span class="h-2 w-1/2 rounded-full bg-line"></span>
                </span>
              </div>
              <div class="mt-6 flex items-center justify-between gap-2">
                <h3 class="text-xl font-medium">Components</h3>
                <span class="text-action" aria-hidden="true">↗</span>
              </div>
              <p class="mt-3 text-muted leading-relaxed">
                The controls and panels we reuse, with examples of their different states.
              </p>
            </a>

            <a
              href="#/screens"
              class="group flex min-w-0 flex-col rounded-lg border border-line bg-surface p-6 hover:border-action hover:bg-action/5"
            >
              <div class="flex h-24 items-center" aria-hidden="true">
                <div
                  class="flex h-24 w-full flex-col overflow-hidden rounded-control border border-line bg-canvas"
                >
                  <div class="flex min-h-0 flex-1">
                    <div class="w-1/4 border-r border-line bg-action/10"></div>
                    <div class="flex flex-1 flex-col gap-2 p-3">
                      <span class="h-1 w-3/4 rounded-full bg-line"></span>
                      <span class="h-1 w-1/2 rounded-full bg-line"></span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-6 flex items-center justify-between gap-2">
                <h3 class="text-xl font-medium">Screens</h3>
                <span class="text-action" aria-hidden="true">↗</span>
              </div>
              <p class="mt-3 text-muted leading-relaxed">
                The agent and editor workspaces, showing what’s open, selected, or being reviewed.
              </p>
            </a>
          </div>
        </section>
      </div>
    `;
  } else if (route.kind === "tokens") {
    body = html`<tokens-view></tokens-view>`;
  } else {
    const { group, entries, entry } = route;
    if (entry) {
      if (group === "screens") {
        screenActions = entry.examples.map(
          (example, index) => html`
            <a
              class="ds-button shrink-0"
              href="./index.html?screen=${entry.id}&example=${index}"
              aria-label="Screen only: ${example.name}"
              >${entry.examples.length > 1 ? example.name + " · " : ""}Screen only ↗</a
            >
          `,
        );
      }
      body = html`
        ${entry.examples.map(
          (example, index) => html`
            <section
              class="${
                group === "screens"
                  ? "grid grid-cols-1 gap-3 py-4"
                  : "grid grid-cols-1 items-center gap-3 border-t border-line py-8 md:grid-cols-component-example md:gap-6"
              }"
            >
              ${group === "screens" ? null : html`<h2 class="text-base text-muted">${example.name}</h2>`}
              <div class="relative min-w-0">
                ${
                  entry.id === "modal" || entry.id === "drawer"
                    ? html`
                        <iframe
                          title="${entry.name}: ${example.name}"
                          src="./index.html?preview=${entry.id}&example=${index}"
                          class="block h-viewer-component-preview w-full rounded-lg border border-line bg-canvas"
                        ></iframe>
                      `
                    : example.markup
                }
              </div>
            </section>
          `,
        )}
        ${
          group !== "screens" && entry.examples.length
            ? html`<div class="border-b border-line" aria-hidden="true"></div>`
            : null
        }
      `;
    } else if (route.kind === "index" && entries) {
      body = entries.length
        ? html`<div>${[...new Set(entries.map((item) => item.category ?? "Screens"))].map((category) => html`
            <section class="mb-12">
              <h2 class="mb-4 text-xl font-medium">${category}</h2>
              ${[...new Set(entries.filter((item) => (item.category ?? "Screens") === category).map((item) => item.subgroup))].map((subgroup) => html`
                <div class="mb-6">
                  ${subgroup ? html`<h3 class="mb-3 text-base text-muted">${subgroup}</h3>` : null}
                  ${entries.filter((item) => (item.category ?? "Screens") === category && item.subgroup === subgroup).map((item) => indexLink(`#/${group}/${item.id}`, item.name))}
                </div>
              `)}
            </section>
          `)}</div>`
        : html`<p class="text-muted">No screens yet.</p>`;
    } else {
      body = html`<a href="#/" class="underline">Overview</a>`;
    }
  }
  if (route.kind === "home") return body;
  return html`
    <header class="mb-6">
      ${route.entry?.subgroup ? html`<p class="mb-3 text-sm text-muted">${route.entry.category} / ${route.entry.subgroup}</p>` : null}
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-title font-medium leading-title tracking-title">${title}</h1>
        ${
          screenActions.length
            ? html`<div class="flex flex-wrap gap-2">${screenActions}</div>`
            : null
        }
      </div>
      ${description ? html`<p class="mt-3 text-muted">${description}</p>` : null}
    </header>
    ${body}
  `;
}
