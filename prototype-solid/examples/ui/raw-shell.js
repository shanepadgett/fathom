/** A complete replacement UI: no imports from the bundled UI plugins. */
export default {
  id: "example.raw-shell",
  apiVersion: 1,
  activate(host) {
    const root = document.querySelector("#app");
    function node(tag, text = "") {
      const element = document.createElement(tag);
      element.textContent = text;
      return element;
    }
    const view = node("main");
    view.style.cssText =
      "max-width:900px;margin:32px auto;padding:24px;font-family:monospace";
    const title = node("h1", "RAW / FATHOM");
    title.style.cssText = "font:700 32px monospace;letter-spacing:0";
    const context = node("p");
    const status = node("p");
    status.setAttribute("role", "status");
    const error = node("p");
    error.setAttribute("role", "alert");
    error.style.color = "#a5320b";
    const transcript = node("section");
    transcript.setAttribute("aria-label", "Conversation");
    const live = node("pre");
    live.style.whiteSpace = "pre-wrap";
    const form = node("form");
    const label = node("label", "Instruction");
    label.htmlFor = "raw-prompt";
    const input = node("textarea");
    input.id = "raw-prompt";
    input.rows = 3;
    input.required = true;
    input.style.cssText =
      "display:block;width:100%;margin:12px 0;padding:12px;border:2px solid";
    const send = node("button", "Run");
    send.type = "submit";
    const stop = node("button", "Stop");
    stop.type = "button";
    form.append(label, input, send, stop);
    view.append(
      title,
      node("p", "External shell plugin / complete UI replacement"),
      context,
      status,
      error,
      transcript,
      live,
      form,
    );
    root.replaceChildren(view);
    let pending = false;
    let rendered;
    const unsubscribe = host.state.subscribe((state) => {
      const data = state.bootstrap;
      error.textContent = state.error;
      if (!data) return;
      context.textContent =
        `${data.workspace} · ${data.runtime} · ${data.model.provider}/${data.model.id}`;
      status.textContent = `${
        state.connected ? "Connected" : "Reconnecting"
      } / ${data.session.status}`;
      send.disabled = pending || data.session.status === "running";
      stop.disabled = data.session.status !== "running";
      const serialized = JSON.stringify(data.session.messages);
      if (serialized !== rendered) {
        rendered = serialized;
        transcript.replaceChildren(...data.session.messages.map((message) => {
          const entry = node("article");
          entry.style.cssText = "border-top:1px solid;padding:16px 0";
          const text = node("pre", message.text || "");
          text.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere";
          entry.append(
            node(
              "strong",
              `${message.role}${
                message.toolName ? ` / ${message.toolName}` : ""
              }${message.isError ? " / failed" : ""}`,
            ),
            text,
          );
          return entry;
        }));
      }
      live.textContent = state.liveText ||
        (state.activeTool ? `Tool: ${state.activeTool.name}` : "");
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || send.disabled) return;
      pending = true;
      host.state.patch({ error: "" });
      try {
        await host.transport.command("message", { text });
        input.value = "";
        await host.transport.refresh();
      } catch (failure) {
        host.state.patch({ error: failure.message });
      } finally {
        pending = false;
        host.state.patch({});
      }
    });
    stop.addEventListener("click", async () => {
      try {
        await host.transport.command("cancel");
        await host.transport.refresh();
      } catch (failure) {
        host.state.patch({ error: failure.message });
      }
    });
    return () => {
      unsubscribe();
      view.remove();
    };
  },
};
