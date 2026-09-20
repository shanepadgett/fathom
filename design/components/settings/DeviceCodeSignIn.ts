import { html, nothing } from "lit";
import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import "../../primitives/button.ts";

export class DeviceCodeSignIn extends DesignElement {
  static override properties = {
    pending: { state: true },
    message: { state: true },
  };
  declare pending: boolean;
  declare message: string;

  constructor() {
    super();
    this.pending = true;
    this.message = "";
  }

  private async copyCode() {
    try {
      await navigator.clipboard.writeText("K7NP-W4RM");
      this.message = "Code copied.";
    } catch {
      this.message = "Select and copy the code above.";
    }
  }

  override render() {
    if (!this.pending) {
      return html`
        <div class="flex items-center justify-between gap-4 py-4">
          <span class="text-sm">Sign in with a device code</span>
          <ds-button variant="secondary"
            size="compact"><button type="button" @click=${() => {
              this.pending = true;
              this.message = "";
            }}>Get code</button></ds-button>
        </div>
      `;
    }

    return html`
      <section class="device-sign-in" aria-label="Device authorization">
        <div class="device-sign-in-body">
          <h2 class="text-base font-medium">Authorize this device</h2>
          <p class="mt-2 text-dense text-muted">Enter this code on the sign-in page.</p>
          <div class="device-sign-in-code">
            <code>K7NP-W4RM</code>
            <ds-button variant="quiet" size="small" icon-only><button type="button" aria-label="Copy device code" title="Copy device code" @click=${() =>
              this.copyCode()}>${icon(
                this.message === "Code copied." ? "check" : "clipboard",
              )}</button></ds-button>
          </div>
          <ds-button variant="primary" size="compact"><button type="button" @click=${() => {
            this.message = "Waiting for authorization.";
          }}>${icon("arrow-square-out")}Open sign-in page</button></ds-button>
          ${this.message && this.message !== "Waiting for authorization."
            ? html`<p class="mt-3 text-micro text-muted" role="status">${this.message}</p>`
            : nothing}
        </div>
        <footer class="device-sign-in-footer">
          <span class="flex items-center gap-2 text-dense text-muted"
            role="status"><span class="device-sign-in-spinner">${icon(
              "spinner-gap",
            )}</span>Waiting for authorization</span>
          <ds-button variant="quiet"
            size="compact"><button type="button" @click=${() => {
              this.pending = false;
              this.message = "";
            }}>Cancel</button></ds-button>
        </footer>
      </section>
    `;
  }
}
customElements.define("device-code-sign-in", DeviceCodeSignIn);
