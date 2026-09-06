import { el } from "../core/dom.js";

function mount(container, host) {
  let signature;
  let expanded = true;
  const workbench = container.closest(".workbench");
  const unsubscribe = host.state.subscribe(({ bootstrap }) => {
    if (!bootstrap) return;
    const next = JSON.stringify([
      bootstrap.plugins,
      bootstrap.tools,
      bootstrap.runtime,
      bootstrap.profiles,
    ]);
    if (next === signature) return;
    signature = next;
    const panel = el(
      "details",
      { class: "composition-panel", open: expanded ? "" : undefined },
      el(
        "summary",
        { class: "section-heading" },
        el("h2", {}, `Composition (${bootstrap.plugins.length})`),
      ),
      el(
        "div",
        { class: "composition-body" },
        el(
          "p",
          { class: "rail-intro" },
          "The harness is the sum of its parts. Every service has an owner.",
        ),
        ...bootstrap.plugins.map((plugin) =>
          el(
            "details",
            { class: "plugin-entry" },
            el(
              "summary",
              {},
              el("span", {}, plugin.id),
              el("span", { class: "plugin-status" }, plugin.status),
            ),
            el(
              "dl",
              {},
              el("dt", {}, "PROVIDES"),
              el("dd", {}, plugin.provides.join(", ") || "—"),
              el("dt", {}, "REQUIRES"),
              el("dd", {}, plugin.requires.join(", ") || "None"),
            ),
          )
        ),
        el("h3", { class: "tool-heading eyebrow" }, "Available tools"),
        ...bootstrap.tools.map((tool) =>
          el(
            "details",
            { class: "tool-entry" },
            el("summary", {}, tool.name),
            el("p", {}, tool.description),
          )
        ),
        el(
          "div",
          { class: "composition-note" },
          "BUILT TO BE REPLACED.",
          el(
            "p",
            {},
            bootstrap.profiles?.includes("echo")
              ? "Switch to Echo to try an alternate runtime. Switching starts a fresh session."
              : "This workbench runs your custom composition. Its plugins are selected by configuration.",
          ),
        ),
      ),
    );
    panel.addEventListener("toggle", () => {
      expanded = panel.open;
      workbench?.classList.toggle("rail-collapsed", !expanded);
    });
    container.replaceChildren(panel);
    workbench?.classList.toggle("rail-collapsed", !expanded);
  });
  return () => {
    unsubscribe();
    workbench?.classList.remove("rail-collapsed");
  };
}

export default {
  id: "ui.composition",
  activate: (host) =>
    host.registerView("composition", {
      title: "Composition",
      slot: "rail",
      mount,
    }),
};
