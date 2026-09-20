import "../components/settings/SettingsSearch.ts";
import type { SettingsSearch } from "../components/settings/SettingsSearch.ts";
import type { SettingSearchResult } from "../components/settings/settings-search-index.ts";
import { html } from "lit";
import { DesignElement } from "../foundation/design-element.ts";
import { icon } from "../primitives/icon.ts";
import { settingsProviders } from "../components/settings/ProviderSettings.ts";
import "../components/settings/GeneralSettings.ts";
import "../components/workspace/fathom-wordmark.ts";

export class SettingsScreen extends DesignElement {
  static override properties = {
    section: { type: String },
    provider: { type: String },
    connections: { state: true },
  };
  declare section: string;
  declare provider: string;
  declare connections: Record<string, boolean>;

  constructor() {
    super();
    this.section = "general";
    this.provider = "openai";
    this.connections = {};
  }

  private selectSetting = async (event: CustomEvent<SettingSearchResult>) => {
    this.section = event.detail.section;
    if (event.detail.provider) this.provider = event.detail.provider;
    await this.updateComplete;
    const general = this.querySelector("general-settings");
    if (general && "updateComplete" in general) await general.updateComplete;
    const row = Array.from(this.querySelectorAll<HTMLElement>("[data-setting]"))
      .find((item) => item.dataset.setting === event.detail.label);
    row?.scrollIntoView({ block: "center" });
    row?.querySelector<HTMLElement>("input, select")?.focus({
      preventScroll: true,
    });
  };

  override render() {
    return html`
      <div class="workspace-shell">
        <div class="settings-shell">
          <header
            class="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-4"><div class="flex items-center gap-6"><fathom-wordmark></fathom-wordmark></div><a class="settings-close" href="./?screen=agent-focus" aria-label="Back to workspace" title="Back to workspace">${icon(
              "x",
              "toolbar",
            )}</a></header>
          <div
            class="settings-body"><nav class="settings-navigation" aria-label="Settings"><button type="button" class="settings-nav-item" @click=${() =>
              this.querySelector<SettingsSearch>("settings-search")
                ?.open()}>${icon("magnifying-glass")}Search settings</button>
              <button class="settings-nav-item" aria-current=${this.section ===
                  "general"
                ? "page"
                : "false"} @click=${() => {
                this.section = "general";
              }}>${icon("sliders-horizontal")}General</button>
              <button class="settings-nav-item" aria-current=${this.section ===
                  "providers"
                ? "page"
                : "false"} @click=${() => {
                this.section = "providers";
              }}>${icon("plugs")}Providers</button>
            </nav>
            ${this.section === "providers"
              ? html`
                <nav class="settings-provider-navigation"
                  aria-label="Providers">${settingsProviders
                    .map((provider) =>
                      html`
                        <button class="settings-nav-item" aria-current=${this
                            .provider === provider.id
                          ? "page"
                          : "false"}
                          @click=${() => {
                            this.provider = provider.id;
                          }}><span class="flex-1">${provider
                            .name}</span><span class="h-1.5 w-1.5 shrink-0 rounded-full ${this
                              .connections[provider.id]
                            ? "bg-success"
                            : "bg-control-line"}" role="img" aria-label=${this
                              .connections[provider.id]
                            ? "Connected"
                            : "Not connected"}></span></button>
                      `
                    )}</nav>
              `
              : null}
            <main class="settings-main">${this.section === "providers"
              ? html`
                <provider-settings .provider=${this
                  .provider} .connected=${this.connections[this.provider] ??
                  false}
                  @connection-change=${(event: CustomEvent<boolean>) => {
                    this.connections = {
                      ...this.connections,
                      [this.provider]: event.detail,
                    };
                  }}></provider-settings>
              `
              : html`<general-settings></general-settings>`}</main>
            </div>
        </div>
      </div>
      <settings-search @setting-select=${this.selectSetting}></settings-search>
    `;
  }
}
customElements.define("settings-screen", SettingsScreen);
