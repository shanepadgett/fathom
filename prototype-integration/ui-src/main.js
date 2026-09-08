import { button, el } from "./core/dom.js";
import { createHost } from "./core/host.js";
import { createState } from "./core/state.js";
import { createTransport } from "./core/transport.js";

const state = createState();
const transport = createTransport(state);
const host = createHost(state, transport);
const root = document.querySelector("#app");
let disconnect;

async function start() {
  root.replaceChildren(el("p", { class: "empty", role: "status" }, "Loading workbench…"));
  try {
    const bootstrap = await transport.refresh();
    root.replaceChildren();
    for (const path of bootstrap.uiPlugins) {
      await host.activate((await import(path)).default);
    }
    disconnect = transport.connect();
  } catch (error) {
    try {
      host.dispose();
    } catch {
      /* The original startup failure remains actionable. */
    }
    root.replaceChildren(
      el(
        "section",
        { class: "empty", role: "alert" },
        el("h1", {}, "FATHOM."),
        el("h2", {}, "Workbench could not start"),
        el("p", {}, error.message),
        button("Retry", start),
      ),
    );
  }
}

await start();
globalThis.addEventListener(
  "pagehide",
  () => {
    disconnect?.();
    host.dispose();
  },
  { once: true },
);
