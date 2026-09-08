import { render, type TemplateResult } from "lit";

export interface ContractHost {
  host: HTMLElement;
  mount: (template: TemplateResult) => Promise<void>;
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function withContractHost(check: (context: ContractHost) => Promise<void>) {
  const host = document.createElement("div");
  host.style.visibility = "hidden";
  document.body.append(host);
  const mount = async (template: TemplateResult) => {
    render(template, host);
    // A frame follows microtasks for the entire nested Lit component tree.
    await new Promise(requestAnimationFrame);
  };
  try {
    await check({ host, mount });
  } finally {
    render(null, host);
    host.remove();
  }
}
