import type { FrontendHost } from "../../sdk/frontend.ts";

import { createEffect, createResource, createSignal, For, onCleanup, onMount } from "solid-js";

import { widgetTheme } from "../theme.ts";
import { Button, IconButton } from "./primitives.tsx";

interface TerminalState {
  id: string;
  sessionId: string;
  title: string;
  output: string;
  running: boolean;
}

export function TerminalPanel(props: {
  theme: string;
  transport: Pick<FrontendHost, "request" | "onEvent" | "projectId">;
  sessionId: string;
  autoStart?: boolean;
  close(): void;
  error(error: unknown): void;
}) {
  let element!: HTMLDivElement;
  const [ready, setReady] = createSignal(false);
  const [revision, setRevision] = createSignal(0);
  const [active, setActive] = createSignal("");
  const [starting, setStarting] = createSignal(false);
  let terminal: import("@xterm/xterm").Terminal | undefined;
  let fit: import("@xterm/addon-fit").FitAddon | undefined;
  let disposed = false;
  let generation = 0;
  let environment = 0;
  let automaticStart = props.autoStart ?? true;
  let selectedSession = props.sessionId;
  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      if (!disposed) props.error(error);
    }
  };
  const refresh = () => setRevision((value) => value + 1);
  const [terminals] = createResource(
    () => ready() && { revision: revision(), sessionId: props.sessionId },
    async (source) => {
      if (source.sessionId !== selectedSession) {
        selectedSession = source.sessionId;
        automaticStart = props.autoStart ?? true;
        setActive("");
      }
      const current = ++generation;
      let items: TerminalState[];
      try {
        items = await props.transport.request<TerminalState[]>("terminal.list");
      } catch (error) {
        if (!disposed && current === generation) {
          automaticStart = false;
          setActive("");
          props.error(error);
        }
        return [];
      }
      if (disposed || current !== generation) return items;
      const available = items.filter((item) => item.sessionId === source.sessionId);
      const selected =
        available.find((item) => item.id === active()) ??
        available.find((item) => item.running) ??
        available[0];
      setActive(selected?.id ?? "");
      // Apply the snapshot in the response continuation, before later WebSocket chunks.
      // Repainting in an effect after the resource settles can overwrite streamed output.
      terminal?.reset();
      if (selected) terminal?.write(selected.output);
      fit?.fit();
      return items;
    },
  );

  const select = (item: TerminalState) => {
    if (!ready()) return;
    setActive(item.id);
    terminal?.reset();
    refresh();
  };
  const start = () => {
    if (
      !ready() ||
      terminals.loading ||
      terminals.error ||
      !terminals() ||
      starting() ||
      !props.sessionId.trim()
    )
      return;
    automaticStart = false;
    setStarting(true);
    const current = environment;
    const sessionId = props.sessionId;
    return act(async () => {
      try {
        const created = await props.transport.request<TerminalState>("terminal.start", {
          sessionId,
        });
        if (!disposed && current === environment && sessionId === props.sessionId) select(created);
      } finally {
        setStarting(false);
      }
    });
  };
  createEffect(() => {
    if (
      ready() &&
      !terminals.loading &&
      !terminals.error &&
      terminals() &&
      !active() &&
      !starting() &&
      automaticStart
    )
      void start();
  });
  createEffect(() => {
    props.theme;
    ready();
    const frame = requestAnimationFrame(() => {
      if (terminal && !disposed) {
        const values = widgetTheme(element);
        terminal.options.theme = values;
        terminal.options.fontFamily = values.fontFamily;
      }
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });
  onMount(() => {
    void Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/xterm/css/xterm.css"),
    ])
      .then(([{ Terminal }, { FitAddon }]) => {
        if (disposed) return;
        terminal = new Terminal({
          fontSize: 12,
          fontFamily: widgetTheme(element).fontFamily,
          theme: widgetTheme(element),
          cursorBlink: true,
          scrollback: 3000,
        });
        fit = new FitAddon();
        terminal.loadAddon(fit);
        terminal.open(element);
        fit.fit();
        terminal.onData((text) => {
          if (terminals()?.some((item) => item.id === active() && item.running)) {
            void act(() => props.transport.request("terminal.write", { id: active(), text }));
          }
        });
        terminal.onResize(({ cols, rows }) => {
          if (active()) {
            void act(() =>
              props.transport.request("terminal.resize", {
                id: active(),
                cols,
                rows,
              }),
            );
          }
        });
        setReady(true);
      })
      .catch(props.error);
    const observer = new ResizeObserver(() => fit?.fit());
    observer.observe(element);
    const unsubscribe = props.transport.onEvent((event) => {
      if (event.projectId && event.projectId !== props.transport.projectId) {
        return;
      }
      if (event.type === "terminal-output") {
        const data = event.data as { id: string; text: string };
        if (data.id === active()) terminal?.write(data.text);
      }
      if (event.type === "terminal") refresh();
      if (
        event.type === "disconnected" ||
        event.type === "connected" ||
        event.type === "environment"
      ) {
        setReady(false);
        ++generation;
        ++environment;
        automaticStart = props.autoStart ?? true;
        setActive("");
        terminal?.reset();
        if (event.type !== "disconnected") {
          refresh();
          setReady(!!terminal);
        }
      }
    });
    onCleanup(() => {
      disposed = true;
      ++generation;
      observer.disconnect();
      unsubscribe();
      terminal?.dispose();
    });
  });
  return (
    <section class="flex h-64 min-h-32 resize-y flex-col border-t border-line bg-canvas">
      <header class="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 text-sm">
        <span>Terminal</span>
        <For each={terminals()?.filter((item) => item.sessionId === props.sessionId)}>
          {(item) => (
            <Button classList={{ selected: item.id === active() }} onClick={() => select(item)}>
              {item.title.slice(0, 25)}
              {item.running ? "" : " · stopped"}
            </Button>
          )}
        </For>
        <span class="spacer" />
        <Button
          disabled={!ready() || terminals.loading || !!terminals.error || starting()}
          onClick={() => void start()}
          title="New terminal"
        >
          ＋
        </Button>
        <Button
          disabled={!terminals()?.some((item) => item.id === active() && item.running)}
          onClick={() =>
            void act(async () => {
              await props.transport.request("terminal.stop", { id: active() });
              refresh();
            })
          }
        >
          Stop
        </Button>
        <IconButton name="x" label="Hide terminal" onClick={props.close} />
      </header>
      <div class="terminal-content" ref={element} />
    </section>
  );
}
