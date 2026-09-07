import { LitElement } from "lit";

// Light DOM intentionally keeps the original shared stylesheet and plugin ABI.
export class HostElement extends LitElement {
  createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    this.style.display = "contents";
    this.unsubscribe = this.host.state.subscribe((state) => {
      this.state = state;
      this.requestUpdate();
    });
  }
  disconnectedCallback() {
    this.unsubscribe?.();
    super.disconnectedCallback();
  }
}

export function mountElement(name, container, host) {
  const node = document.createElement(name);
  node.host = host;
  container.append(node);
  return () => node.remove();
}
