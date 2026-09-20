import { html, nothing } from "lit";
import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import "../../primitives/button.ts";
import "./DeviceCodeSignIn.ts";

export const settingsProviders = [
  {
    id: "openai",
    name: "OpenAI",
    monogram: "O",
    description: "Connect OpenAI to use GPT models in your workspace.",
    account: "ChatGPT",
    deviceCode: false,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    monogram: "A",
    description: "Connect Anthropic to use Claude models in your workspace.",
    account: "Claude",
    deviceCode: false,
  },
  {
    id: "xai",
    name: "xAI",
    monogram: "x",
    description: "Connect xAI to use Grok models in your workspace.",
    account: null,
    deviceCode: false,
  },
  {
    id: "device-demo",
    name: "Device flow",
    monogram: "D",
    account: null,
    deviceCode: true,
  },
] as const;

export class ProviderSettings extends DesignElement {
  static override properties = {
    provider: { type: String },
    status: { state: true },
    connected: { type: Boolean },
  };
  declare provider: string;
  declare status: string;
  declare connected: boolean;

  constructor() {
    super();
    this.provider = "openai";
    this.status = "";
    this.connected = false;
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has("provider")) {
      this.status = "";
      const input = this.querySelector<HTMLInputElement>("input");
      if (input) input.value = "";
    }
  }

  private connect = (event: SubmitEvent) => {
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent("connection-change", { detail: true, bubbles: true }),
    );
    this.status = "Connected.";
    if (event.target instanceof HTMLFormElement) event.target.reset();
  };

  override render() {
    const provider =
      settingsProviders.find((item) => item.id === this.provider) ??
        settingsProviders[0];
    return html`
      <div class="settings-content">
        <header class="mb-8 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="provider-monogram">${provider.monogram}</span>
            <h1 class="text-2xl font-semibold">${provider.name}</h1>
          </div>
          <span class="inline-flex items-center gap-2 text-dense text-muted">
            ${this.connected ? "Connected" : "Not connected"}
          </span>
        </header>
        <section aria-label="Connection methods">
          ${provider.account
            ? html`
              <div class="flex flex-wrap items-center justify-between gap-4 py-4">
                <span class="text-sm">Use your ${provider
                  .account} subscription</span>
                <ds-button variant="secondary" size="compact">
                  <button type="button" @click=${() => {
                    this.status = "Waiting for sign-in.";
                  }}>
                  ${icon("arrow-square-out")}Sign in with ${provider.account}
                </button>
                </ds-button>
              </div>
              <div
                class="my-6 flex items-center gap-3 text-micro text-muted"><span class="h-px flex-1 bg-line"></span>OR<span class="h-px flex-1 bg-line"></span></div>
            `
            : nothing}
          ${provider.deviceCode
            ? html`
              <device-code-sign-in></device-code-sign-in>
              <div
                class="my-6 flex items-center gap-3 text-micro text-muted"><span class="h-px flex-1 bg-line"></span>OR<span class="h-px flex-1 bg-line"></span></div>
            `
            : nothing}
          <form @submit=${this.connect}>
            <label class="block text-dense" for="provider-api-key">API key</label>
            <div class="mt-2 flex items-center gap-3">
              <input id="provider-api-key" class="setting-input min-w-0 flex-1" type="password" required autocomplete="off" placeholder="Paste API key" />
              <ds-button variant="primary" size="compact"><button type="submit">${this
                  .connected
                ? "Replace key"
                : "Connect"}</button></ds-button>
              ${this.connected
                ? html`
                  <ds-button variant="secondary"
                    size="compact"><button type="button" @click=${() => {
                      this.dispatchEvent(
                        new CustomEvent("connection-change", {
                          detail: false,
                          bubbles: true,
                        }),
                      );
                      this.status = "Disconnected.";
                    }}>Disconnect</button></ds-button>
                `
                : nothing}
            </div>
          </form>
          <p class="mt-4 text-dense text-action" role="status">${this
            .status}</p>
        </section>
      </div>
    `;
  }
}
customElements.define("provider-settings", ProviderSettings);
