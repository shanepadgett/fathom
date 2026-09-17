import { fileURLToPath } from "node:url";

import { instantiate, libName, Pty } from "@sigma/pty-ffi/noinit";
import { Type } from "typebox";

import { workspaceEnvironment } from "../kernel/runtime.ts";
import { definePlugin } from "../sdk/mod.ts";

interface Terminal {
  id: string;
  sessionId: string;
  title: string;
  output: string;
  startedAt: number;
  exitCode?: number;
  pty?: Pty;
  timer?: ReturnType<typeof setInterval>;
  decoder: TextDecoder;
}

export default definePlugin({
  id: "fathom:terminal",
  apiVersion: 1,
  backend: {
    requires: ["workspace", "rpc", "tools", "events"],
    provides: ["terminal"],
    activate(ctx) {
      const workspace = ctx.get("workspace"),
        rpc = ctx.get("rpc"),
        tools = ctx.get("tools"),
        events = ctx.get("events");
      const terminals = new Map<string, Terminal>();
      let initialized: Promise<unknown> | undefined;
      let disposed = false;
      const describe = (terminal: Terminal) => ({
        id: terminal.id,
        sessionId: terminal.sessionId,
        title: terminal.title,
        output: terminal.output,
        startedAt: terminal.startedAt,
        exitCode: terminal.exitCode,
        running: !!terminal.pty,
      });
      const get = (id: string) => {
        const terminal = terminals.get(id);
        if (!terminal) throw new Error("Terminal not found");
        return terminal;
      };
      const stop = (id: string) => {
        const terminal = get(id);
        clearInterval(terminal.timer);
        terminal.pty?.close();
        terminal.pty = undefined;
        events.publish({
          type: "terminal",
          sessionId: terminal.sessionId,
          data: describe(terminal),
        });
      };
      const start = async (sessionId: string, command?: string) => {
        if (disposed) throw new Error("Terminal service disposed");
        initialized ??= instantiate(
          Deno.env.get("FATHOM_PTY_LIBRARY") ??
            (Deno.build.standalone
              ? fileURLToPath(new URL(`../native/${libName()}`, import.meta.url))
              : undefined),
        );
        await initialized;
        if (disposed) throw new Error("Terminal service disposed");
        if ([...terminals.values()].filter((terminal) => terminal.pty).length >= 12) {
          throw new Error("Close a terminal before starting another");
        }
        const terminal: Terminal = {
          id: crypto.randomUUID(),
          sessionId,
          title: command ?? "Shell",
          output: "",
          startedAt: Date.now(),
          decoder: new TextDecoder(),
        };
        // PTY environments overlay the parent's values. Remove the host address
        // before env replaces itself with the shell, preserving process ownership.
        terminal.pty = new Pty("/usr/bin/env", {
          args: [
            "-u",
            "DENO_SERVE_ADDRESS",
            command !== undefined ? "/bin/bash" : (Deno.env.get("SHELL") ?? "/bin/bash"),
            ...(command !== undefined ? ["-c", command] : []),
          ],
          cwd: workspace.root,
          env: { ...workspaceEnvironment(), TERM: "xterm-256color" },
          size: { cols: 100, rows: 25, pixel_width: 0, pixel_height: 0 },
        });
        terminals.set(terminal.id, terminal);
        events.publish({
          type: "terminal",
          sessionId,
          data: describe(terminal),
        });
        terminal.timer = setInterval(() => {
          try {
            const result = terminal.pty!.readBytes();
            const chunk = terminal.decoder.decode(result.data, {
              stream: !result.done,
            });
            terminal.output = (terminal.output + chunk).slice(-100_000);
            if (chunk) {
              events.publish({
                type: "terminal-output",
                sessionId,
                data: { id: terminal.id, text: chunk },
              });
            }
            if (result.done) {
              terminal.exitCode = terminal.pty!.exitCode;
              stop(terminal.id);
            }
          } catch {
            stop(terminal.id);
          }
        }, 32);
        return describe(terminal);
      };
      ctx.provide("terminal", {
        list: () => [...terminals.values()].map(describe),
        start,
        stop,
      });
      const disposers = [
        rpc.register("terminal.list", () => [...terminals.values()].map(describe)),
        rpc.register("terminal.start", (params) => start(String(params.sessionId))),
        rpc.register("terminal.write", (params) => {
          get(String(params.id)).pty?.write(String(params.text));
          return {};
        }),
        rpc.register("terminal.resize", (params) => {
          const cols = Number(params.cols),
            rows = Number(params.rows);
          if (![cols, rows].every((value) => Number.isInteger(value) && value > 0 && value <= 1000))
            throw new Error("Invalid terminal size");
          get(String(params.id)).pty?.resize({
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
          });
          return {};
        }),
        rpc.register("terminal.stop", (params) => {
          stop(String(params.id));
          return {};
        }),
        tools.register({
          name: "pty",
          description:
            "Start, list, inspect, interact with or stop workspace background terminals. Use start for development servers and read for bounded output.",
          parameters: Type.Object({
            action: Type.Union([
              Type.Literal("start"),
              Type.Literal("list"),
              Type.Literal("read"),
              Type.Literal("write"),
              Type.Literal("kill"),
            ]),
            id: Type.Optional(Type.String()),
            command: Type.Optional(Type.String()),
            text: Type.Optional(Type.String()),
            lines: Type.Optional(Type.Integer({ minimum: 1, maximum: 3000 })),
          }),
          async execute(args, context) {
            if (args.action === "start") {
              return JSON.stringify(
                await start(
                  context.sessionId,
                  args.command === undefined ? undefined : String(args.command),
                ),
              );
            }
            if (args.action === "list") {
              return JSON.stringify(
                [...terminals.values()]
                  .filter((item) => item.sessionId === context.sessionId)
                  .map(describe),
              );
            }
            const terminal = get(String(args.id));
            if (terminal.sessionId !== context.sessionId) {
              throw new Error("Terminal belongs to another session");
            }
            if (args.action === "read") {
              return terminal.output
                .split("\n")
                .slice(-Number(args.lines ?? 50))
                .join("\n");
            }
            if (args.action === "kill") stop(terminal.id);
            else terminal.pty?.write(String(args.text ?? ""));
            return JSON.stringify(describe(terminal));
          },
        }),
      ];
      ctx.effect(() => () => {
        disposed = true;
        for (const dispose of disposers) dispose();
        for (const terminal of terminals.values()) stop(terminal.id);
      });
    },
  },
});
