import { el } from "../core/dom.js";

import { createContextMeter } from "../components/context-meter.js";

export default {
  id: "ui.shell",
  activate(host) {
    const root = document.querySelector("#app");
    const model = el("span", {}, "Connecting…");
    const workspace = el(
      "span",
      { class: "workspace-path" },
      "Loading workspace",
    );
    const status = el(
      "span",
      { class: "footer-status status", role: "status" },
      "Connecting",
    );
    const context = createContextMeter();
    const profile = el(
      "select",
      {
        id: "runtime",
        "aria-label": "Runtime composition",
        "aria-describedby": "runtime-note",
      },
    );
    const runtimeNote = el("small", {
      id: "runtime-note",
      class: "runtime-note",
    });
    let switching = false;
    let profileSignature;
    const error = el("div", {
      class: "error-banner",
      role: "alert",
      hidden: "",
    });
    const main = el("main", { class: "main-view" });
    const rail = el("aside", {
      class: "side-rail",
      "aria-label": "Plugin composition",
    });
    root.append(
      el(
        "div",
        { class: "context-bar" },
        el(
          "div",
          { class: "context-brand" },
          el("h1", {}, "FATHOM", el("span", {}, ".")),
        ),
        el("div", {}, el("span", { class: "eyebrow" }, "Workspace"), workspace),
        el("div", {}, el("span", { class: "eyebrow" }, "Model"), model),
        el(
          "div",
          {},
          el("label", { for: "runtime", class: "eyebrow" }, "Runtime"),
          profile,
          runtimeNote,
        ),
      ),
      error,
      el("div", { class: "workbench" }, main, rail),
      el(
        "footer",
        {},
        status,
        context.node,
      ),
    );
    profile.addEventListener("change", async () => {
      const selected = profile.value;
      switching = true;
      profile.disabled = true;
      host.state.patch({ error: "", liveText: "" });
      try {
        await host.transport.command("profile", { profile: selected });
        await host.transport.refresh();
      } catch (failure) {
        host.state.patch({ error: failure.message });
      } finally {
        switching = false;
        host.state.patch({});
      }
    });
    const unsubscribe = host.state.subscribe((state) => {
      error.hidden = !state.error;
      error.textContent = state.error;
      if (!state.bootstrap) return;
      const data = state.bootstrap;
      workspace.textContent = data.workspace;
      workspace.title = data.workspace;
      model.textContent = `${data.model.provider} / ${data.model.id}`;
      const profiles = data.profiles || [];
      const signature = JSON.stringify([profiles, data.runtime]);
      if (signature !== profileSignature) {
        profileSignature = signature;
        profile.replaceChildren(
          ...(profiles.length
            ? profiles.map((name) =>
              el(
                "option",
                { value: name },
                name === "default"
                  ? "Default / pi-ai"
                  : name === "echo"
                  ? "Echo / alternate runtime"
                  : name,
              )
            )
            : [el("option", { value: "custom" }, data.runtime)]),
        );
      }
      profile.value = profiles.length ? data.profile : "custom";
      profile.disabled = switching || !profiles.length ||
        data.session.status === "running";
      runtimeNote.textContent = profiles.length
        ? "Switching starts a fresh session"
        : "Custom composition";
      status.textContent = state.connected
        ? data.session.status === "running"
          ? "Working"
          : data.session.status === "idle"
          ? "Idle"
          : data.session.status
        : "Reconnecting";
      status.dataset.state = state.connected ? data.session.status : "offline";
      context.update(data.session, state.liveText);
    });
    const mounted = new Map();
    function reconcile() {
      for (const [id, entry] of mounted) {
        if (!host.views.has(id)) {
          entry.dispose?.();
          entry.node.remove();
          mounted.delete(id);
        }
      }
      for (const [id, view] of host.views) {
        if (mounted.has(id)) continue;
        const node = el("section", {
          class: "extension-view",
          "aria-label": view.title,
        });
        (view.slot === "rail" ? rail : main).append(node);
        mounted.set(id, { node, dispose: view.mount(node, host) });
      }
    }
    const unregistry = host.onRegistryChange(reconcile);
    reconcile();
    return () => {
      unsubscribe();
      unregistry();
      mounted.forEach((entry) => entry.dispose?.());
      root.replaceChildren();
    };
  },
};
