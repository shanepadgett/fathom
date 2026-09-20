import { html } from "lit";
import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import { resultFrame } from "../navigation/search-result-frame.ts";
import {
  type SettingSearchResult,
  settingSearchResults,
} from "./settings-search-index.ts";
import "../navigation/search-surface.ts";
import "../../primitives/modal.ts";

export class SettingsSearch extends DesignElement {
  static override properties = {
    query: { state: true },
    selected: { state: true },
  };
  declare query: string;
  declare selected: number;

  constructor() {
    super();
    this.query = "";
    this.selected = 0;
  }

  async open() {
    this.query = "";
    this.selected = 0;
    await this.updateComplete;
    this.querySelector("dialog")?.showModal();
    this.querySelector("input")?.focus();
  }

  private get results() {
    const words = this.query.toLowerCase().trim().split(/\s+/);
    return settingSearchResults.filter((result) =>
      words.every((word) =>
        `${result.label} ${result.group}`.toLowerCase().includes(word)
      )
    );
  }

  private choose(result: SettingSearchResult) {
    this.querySelector("dialog")?.close();
    this.dispatchEvent(
      new CustomEvent<SettingSearchResult>("setting-select", {
        detail: result,
        bubbles: true,
      }),
    );
  }

  private navigate = (event: KeyboardEvent) => {
    const results = this.results;
    if (!results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      this.selected = (this.selected + (event.key === "ArrowDown" ? 1 : -1) +
        results.length) % results.length;
      void this.updateComplete.then(() =>
        this.querySelector(`[data-result="${this.selected}"]`)?.scrollIntoView({
          block: "nearest",
        })
      );
    }
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      this.choose(results[this.selected]);
    }
  };

  override render() {
    const results = this.results;
    return html`
      <ds-modal>
        <dialog class="settings-search-dialog" aria-label="Search settings"
          @keydown=${this.navigate} @click=${(event: MouseEvent) => {
            if (
              event.target === event.currentTarget &&
              event.currentTarget instanceof HTMLDialogElement
            ) event.currentTarget.close();
          }}>
          <search-surface .label=${"Search settings"} .heading=${this.query
            ? `${results.length} results`
            : "All settings"} .action=${"Open setting"}
            .field=${html`
              <div
                class="flex items-center gap-3 border-b border-line px-4 py-3">${icon(
                  "magnifying-glass",
                )}<input class="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Search settings" placeholder="Search settings…" .value=${this
                  .query} @input=${(event: InputEvent) => {
                  if (event.target instanceof HTMLInputElement) {
                    this.query = event.target.value;
                  }
                  this.selected = 0;
                }} /><button type="button" class="settings-close" data-close aria-label="Close search">${icon(
                  "x",
                )}</button></div>
            `}
            .results=${html`<div class="settings-search-results">${
              results.length
                ? results.map((result, index) =>
                  html`
                    <button type="button" class="block w-full text-left" data-result=${index}
                      @click=${() => this.choose(result)}>${resultFrame(
                        icon(
                          result.section === "general"
                            ? "sliders-horizontal"
                            : "plugs",
                        ),
                        html`
                          <span class="block text-sm">${result
                            .label}</span><span
                            class="block text-xs text-muted">${result
                              .group}</span>
                        `,
                        "",
                        this.selected === index,
                      )}</button>
                  `
                )
                : html`
                  <p class="px-3 py-6 text-sm text-muted"
                    role="status">No settings found. Try “theme” or “API key”.</p>
                `
            }</div>`}
          ></search-surface>
        </dialog>
      </ds-modal>
    `;
  }
}
customElements.define("settings-search", SettingsSearch);
