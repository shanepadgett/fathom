import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { mountEditor } from "../components/editor.js";
import { mountTerminal } from "../components/terminal.js";
import "../workbench.css";

function Workbench(props) {
  const [state, setState] = createSignal({
    documents: [],
    approvals: [],
    jobs: [],
    mcpTools: [],
  });
  const [doc, setDoc] = createSignal();
  const [error, setError] = createSignal("");
  const [result, setResult] = createSignal("");
  let editorNode,
    terminalNode,
    pathInput,
    codeInput,
    runtimeInput,
    toolInput,
    argsInput,
    urlInput;
  let editor, terminal, stopped = false, pendingText, saving = false, timer;
  const report = (error) => setError(error.message || String(error));
  async function command(action, args = {}) {
    const response = await fetch("/api/workbench", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, args }),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error);
    return value;
  }
  async function act(action, args) {
    setError("");
    try {
      return await command(action, args);
    } catch (error) {
      report(error);
    }
  }
  async function flush() {
    if (saving || pendingText === undefined || !doc()) return;
    saving = true;
    const text = pendingText;
    pendingText = undefined;
    try {
      setDoc(
        await command("change", {
          path: doc().path,
          version: doc().version,
          text,
        }),
      );
    } catch (error) {
      report(error);
      pendingText = text;
    } finally {
      saving = false;
    }
  }
  async function open() {
    if (pendingText !== undefined || saving) {
      report(
        new Error(
          "Wait for editor changes to sync before opening another file",
        ),
      );
      return;
    }
    const value = await act("open", { path: pathInput.value });
    if (value) {
      setDoc(value);
      editor.update(value);
    }
  }
  async function save() {
    await flush();
    if (pendingText !== undefined || saving || !doc()) return;
    const value = await act("save", {
      path: doc().path,
      version: doc().version,
    });
    if (value) setDoc(value);
  }
  async function poll() {
    if (stopped) return;
    try {
      await flush();
      const response = await fetch("/api/workbench");
      const next = await response.json();
      if (!response.ok) throw new Error(next.error);
      if (stopped) return;
      setState(next);
      terminal.update(next.terminal);
      const current = next.documents.find((d) => d.path === doc()?.path);
      if (current && pendingText === undefined && !saving) {
        setDoc(current);
        editor.update(current);
      }
    } catch (error) {
      if (!stopped) report(error);
    } finally {
      if (!stopped) timer = setTimeout(poll, 250);
    }
  }
  onMount(() => {
    editor = mountEditor(editorNode, (text) => {
      pendingText = text;
    });
    terminal = mountTerminal(terminalNode, command, report);
    pathInput.value = "issues.ts";
    codeInput.value =
      'import { mcp } from "fathom:mcp";\nconsole.log(await mcp.greet({ name: "Fathom" }));';
    argsInput.value = '{"name":"Fathom"}';
    poll();
  });
  onCleanup(() => {
    stopped = true;
    clearTimeout(timer);
    editor?.dispose();
    terminal?.dispose();
  });
  return (
    <div class="integration-panel">
      <h2>Integration bench</h2>
      <p class="hint">
        Deno LSP · editor and agent share one document and diagnostic store
      </p>
      <div role="alert" class="bench-error">{error()}</div>
      <div class="bench-toolbar">
        <input
          ref={pathInput}
          aria-label="File path"
          placeholder="TypeScript file path"
        />
        <button type="button" onClick={open}>Open file</button>
        <button type="button" disabled={!doc()} onClick={save}>Save</button>
      </div>
      <div class="hint">
        {doc()
          ? `v${doc().version} · ${
            doc().text === doc().saved ? "Saved" : "Unsaved"
          } · ${
            doc().diagnosticVersion === doc().version
              ? "LSP current"
              : "LSP pending"
          }`
          : "Open a TypeScript file"}
      </div>
      <div ref={editorNode} class="monaco-container" aria-label="Code editor" />
      <div class="diagnostics" aria-label="LSP diagnostics">
        <For each={doc()?.diagnostics ?? []}>
          {(d) => (
            <p>
              {d.range.start.line + 1}:{d.range.start.character + 1} ·{" "}
              {d.message}
            </p>
          )}
        </For>
        <button
          type="button"
          disabled={!doc()}
          onClick={() =>
            act("tool", { name: "diagnostics", args: { path: doc().path } })}
        >
          Read diagnostics as agent
        </button>
        <button
          type="button"
          disabled={!doc()}
          onClick={() =>
            props.host.transport.command("message", {
              text:
                `Use editor_read and diagnostics for ${doc().path}. Fix the language errors with editor_edit, then check diagnostics again.`,
            }).catch(report)}
        >
          Ask agent to fix
        </button>
      </div>
      <details open>
        <summary>
          Terminal · {state().terminal?.running ? "running" : "stopped"}
        </summary>
        <button type="button" onClick={() => act("terminal-start")}>
          Start shell
        </button>
        <button type="button" onClick={() => act("terminal-stop")}>
          Stop shell
        </button>
        <div ref={terminalNode} class="terminal-container" />
      </details>
      <details>
        <summary>MCP and scripts</summary>
        <div class="bench-toolbar">
          <input
            ref={urlInput}
            aria-label="MCP URL"
            placeholder="http://localhost:.../mcp"
          />
          <button
            type="button"
            onClick={() => act("connect", { url: urlInput.value })}
          >
            Connect HTTP
          </button>
        </div>
        <button type="button" onClick={() => act("connect-fixture")}>
          Connect local MCP fixture
        </button>
        <p class="hint">
          Or launch the included fixture using the connection instructions in
          README.md.
        </p>
        <div class="bench-toolbar">
          <select ref={toolInput} aria-label="MCP tool">
            <For each={state().mcpTools}>
              {(t) => <option value={t.name}>{t.name}</option>}
            </For>
          </select>
          <input ref={argsInput} aria-label="MCP arguments" />
          <button
            type="button"
            onClick={() => {
              try {
                act("tool", {
                  name: `mcp_${toolInput.value}`,
                  args: JSON.parse(argsInput.value),
                });
              } catch (error) {
                report(error);
              }
            }}
          >
            Call MCP tool
          </button>
        </div>
        <select ref={runtimeInput} aria-label="Script runtime">
          <option>deno</option>
          <option>node</option>
          <option>python3</option>
          <option>bash</option>
        </select>
        <textarea
          ref={codeInput}
          class="script-source"
          aria-label="Script source"
        />
        <button
          type="button"
          onClick={() =>
            act("tool", {
              name: "script",
              args: { runtime: runtimeInput.value, code: codeInput.value },
            })}
        >
          Request script run
        </button>
      </details>
      <For each={state().approvals}>
        {(a) => (
          <section class="approval">
            <strong>Approval required</strong>
            <pre>{a.description}</pre>
            <button
              type="button"
              onClick={() => act("approve", { id: a.id, allow: true })}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => act("approve", { id: a.id, allow: false })}
            >
              Deny
            </button>
          </section>
        )}
      </For>
      <details open>
        <summary>Agent tool results / verification</summary>
        <For each={state().jobs}>
          {(job) => (
            <div>
              <button
                type="button"
                onClick={() => setResult(job.result || job.status)}
              >
                {job.tool} · {job.status}
              </button>
              <Show when={job.status === "running"}>
                <button
                  type="button"
                  onClick={() => act("cancel-job", { id: job.id })}
                >
                  Cancel
                </button>
              </Show>
              <pre>{job.result}</pre>
            </div>
          )}
        </For>
        <Show when={result()}>
          <pre>{result()}</pre>
        </Show>
      </details>
    </div>
  );
}
export default {
  id: "ui.workbench",
  activate: (host) =>
    host.registerView("workbench", {
      title: "Integration bench",
      slot: "editor",
      mount: (container, host) =>
        render(() => <Workbench host={host} />, container),
    }),
};
