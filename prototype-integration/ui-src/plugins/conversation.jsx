import { createEffect, createMemo, createSignal, Index, onMount, Show } from "solid-js";
import { render } from "solid-js/web";

import { renderMarkdown } from "../components/markdown.js";
import { useHostState, useRegistry } from "../core/component.js";

const emptyTitle = "A workbench.\nYour way.";

function Message(props) {
  const custom = createMemo(() => {
    props.revision();
    const message = JSON.parse(JSON.stringify(props.message));
    const renderer = [...props.host.renderers.values()].find((entry) => entry.matches(message));
    return renderer?.render(message, props.host);
  });
  return (
    <Show
      when={custom()}
      fallback={
        <Show
          when={props.message.role === "tool"}
          fallback={
            <div
              class="message-text markdown"
              innerHTML={renderMarkdown(props.message.text || "")}
            />
          }
        >
          <details class={`evidence ${props.message.isError ? "failed" : ""}`}>
            <summary>
              {props.message.toolName || "Tool"} / {props.message.isError ? "failed" : "result"}
            </summary>
            <Show when={props.message.args}>
              <pre class="message-text">{JSON.stringify(props.message.args, null, 2)}</pre>
            </Show>
            <pre class="message-text">{props.message.text || ""}</pre>
          </details>
        </Show>
      }
    >
      {(node) => node()}
    </Show>
  );
}

function Conversation(props) {
  const host = props.host;
  const state = useHostState(host);
  const revision = useRegistry(host);
  const busy = () => state.bootstrap?.session.status === "running";
  const messages = () => state.bootstrap?.session.messages || [];
  const [submitting, setSubmitting] = createSignal(false);
  let textarea;
  let form;
  let ledger;
  let follow = true;
  function resize() {
    textarea.style.height = "auto";
    const style = getComputedStyle(textarea);
    const line = parseFloat(style.lineHeight);
    const chrome =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const desired = Math.max(line * 2 + chrome, textarea.scrollHeight);
    textarea.style.height = `${Math.min(desired, line * 4 + chrome)}px`;
    textarea.style.overflowY = desired > line * 4 + chrome ? "auto" : "hidden";
  }
  onMount(resize);
  createEffect(() => {
    void JSON.stringify(messages());
    void state.liveText;
    void state.activeTool;
    void busy();
    void revision();
    queueMicrotask(() => {
      if (follow && ledger?.isConnected) ledger.scrollTop = ledger.scrollHeight;
    });
  });
  async function act(name) {
    host.state.patch({ error: "" });
    try {
      await host.transport.command(name);
      await host.transport.refresh();
    } catch (error) {
      host.state.patch({ error: error.message });
    }
  }
  async function submit(event) {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text || submitting() || busy()) return;
    setSubmitting(true);
    host.state.patch({ error: "", liveText: "" });
    try {
      await host.transport.command("message", { text });
      textarea.value = "";
      resize();
      await host.transport.refresh();
    } catch (error) {
      host.state.patch({ error: error.message });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <>
      <div class="section-heading">
        <h2>Working transcript</h2>
        <button type="button" disabled={busy() || !messages().length} onClick={() => act("reset")}>
          New session
        </button>
      </div>
      <div
        ref={(el) => {
          ledger = el;
        }}
        class="ledger"
        aria-label="Conversation"
        onScroll={() => {
          follow = ledger.scrollHeight - ledger.scrollTop - ledger.clientHeight < 100;
        }}
      >
        <Index each={messages()}>
          {(message, index) => (
            <article class={`ledger-row ${message().role}`}>
              <span class="row-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <div class="role">
                  {message().role === "user" ? "You / instruction" : message().role}
                </div>
                <Message message={message()} host={host} revision={revision} />
              </div>
            </article>
          )}
        </Index>
        <Show when={!messages().length}>
          <section class="empty">
            <h3>{emptyTitle}</h3>
            <p>Give the agent a task. Inspect its work. Swap the pieces that make it yours.</p>
            <div class="starters">
              {[
                "Read the files in this workspace and explain its structure.",
                "Create hello.txt with a short greeting, then read it back.",
              ].map((prompt) => (
                <button
                  type="button"
                  onClick={() => {
                    textarea.value = prompt;
                    resize();
                    textarea.focus();
                  }}
                >
                  {prompt} ↗
                </button>
              ))}
            </div>
          </section>
        </Show>
        <Show when={busy() || state.liveText}>
          <article class="ledger-row live">
            <span class="row-number">↳</span>
            <div>
              <div class="role">Agent / working</div>
              <div
                class="message-text markdown"
                innerHTML={renderMarkdown(
                  state.liveText ||
                    (state.activeTool
                      ? `${state.activeTool.name}\n${JSON.stringify(
                          state.activeTool.args,
                          null,
                          2,
                        )}`
                      : "Thinking…"),
                )}
              />
            </div>
          </article>
        </Show>
      </div>
      <form
        ref={(el) => {
          form = el;
        }}
        class="composer"
        onSubmit={submit}
      >
        <textarea
          ref={(el) => {
            textarea = el;
          }}
          id="prompt"
          aria-label="Your instruction"
          placeholder="Describe the work. Be specific."
          rows="2"
          required
          onInput={resize}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              form.requestSubmit();
            }
          }}
        />
        <div class="composer-actions">
          <span class="hint">⌘ / Ctrl + Enter to run</span>
          <button type="button" disabled={!busy()} onClick={() => act("cancel")}>
            Stop ■
          </button>
          <button type="submit" class="primary" disabled={busy() || submitting()}>
            Run agent ↗
          </button>
        </div>
      </form>
    </>
  );
}
export default {
  id: "ui.conversation",
  activate: (host) =>
    host.registerView("conversation", {
      title: "Conversation",
      slot: "main",
      mount: (container, host) => render(() => <Conversation host={host} />, container),
    }),
};
