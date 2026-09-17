import type { DevServer, DevServersSnapshot, TerminalInfo } from "../sdk/mod.ts";

import { definePlugin } from "../sdk/mod.ts";

type Parser = {
  sessionId: string;
  token: string;
  overflow: boolean;
  escape: "text" | "escape" | "csi" | "string" | "string-escape";
};

const MAX_TOKEN = 2048;
const MAX_SERVERS = 16;

function localUrl(token: string): string | undefined {
  // Match the original authority too: URL normalization accepts ambiguous IPv4 forms.
  const value = token.replace(/[.,;!?)}]+$/, "");
  if (
    !/^https?:\/\/(?:localhost|127(?:\.(?:0|[1-9]\d{0,2})){3}|\[::1\])(?::\d{1,5})?(?:[/?#]|$)/i.test(
      value,
    )
  )
    return;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.port === "0") return;
    if (
      url.hostname !== "localhost" &&
      url.hostname !== "[::1]" &&
      !url.hostname.startsWith("127.")
    )
      return;
    return url.href;
  } catch {
    return;
  }
}

// Streaming tokenizer: never publish a URL before its delimiter (including a split port).
// OSC/DCS payloads are discarded, not interpreted as visible terminal output.
function consume(parser: Parser, text: string, found: (url: string) => void) {
  const finish = () => {
    if (!parser.overflow) {
      const url = localUrl(parser.token);
      if (url) found(url);
    }
    parser.token = "";
    parser.overflow = false;
  };
  for (const char of text) {
    if (parser.escape === "string") {
      if (char === "\x07" || char === "\x9c") parser.escape = "text";
      else if (char === "\x1b") parser.escape = "string-escape";
      continue;
    }
    if (parser.escape === "string-escape") {
      parser.escape = char === "\\" ? "text" : "string";
      continue;
    }
    if (parser.escape === "csi") {
      if (char >= "@" && char <= "~") parser.escape = "text";
      continue;
    }
    if (parser.escape === "escape") {
      parser.escape = char === "[" ? "csi" : "]PX^_".includes(char) ? "string" : "text";
      continue;
    }
    if (char === "\x1b") {
      parser.escape = "escape";
      continue;
    }
    if (char === "\x9b") {
      parser.escape = "csi";
      continue;
    }
    if (char === "\x9d" || char === "\x90") {
      parser.escape = "string";
      continue;
    }
    if (/\s|[<>"'`(]/.test(char) || char < " ") {
      finish();
      continue;
    }
    if (parser.token.length < MAX_TOKEN) parser.token += char;
    else parser.overflow = true;
  }
}

export default definePlugin({
  id: "fathom:dev-servers",
  apiVersion: 1,
  backend: {
    requires: ["terminal", "events", "rpc"],
    provides: ["devServers"],
    activate(ctx) {
      const parsers = new Map<string, Parser>();
      const servers = new Map<string, DevServer>();
      const listeners = new Set<(snapshot: DevServersSnapshot) => void>();
      let revision = 0;
      const snapshot = (): DevServersSnapshot => ({
        revision,
        servers: [...servers.values()].map((server) => ({ ...server })),
      });
      const publish = () => {
        revision++;
        ctx.get("events").publish({ type: "dev-servers", data: snapshot() });
        for (const listener of listeners) {
          try {
            listener(snapshot());
          } catch (error) {
            console.error("Dev-server listener failed", error);
          }
        }
      };
      const output = (id: string, text: string) => {
        const parser = parsers.get(id);
        if (!parser) return;
        let changed = false;
        consume(parser, text, (url) => {
          const key = `${id}:${url}`;
          if (
            servers.has(key) ||
            [...servers.values()].filter((server) => server.terminalId === id).length >= MAX_SERVERS
          )
            return;
          servers.set(key, {
            id: key,
            terminalId: id,
            sessionId: parser.sessionId,
            url,
          });
          changed = true;
        });
        if (changed) publish();
      };
      const terminal = (info: TerminalInfo) => {
        if (info.running) {
          if (!parsers.has(info.id)) {
            parsers.set(info.id, {
              sessionId: info.sessionId,
              token: "",
              overflow: false,
              escape: "text",
            });
            output(info.id, info.output);
          }
          return;
        }
        parsers.delete(info.id);
        let changed = false;
        for (const [id, server] of servers) {
          if (server.terminalId === info.id) {
            servers.delete(id);
            changed = true;
          }
        }
        if (changed) publish();
      };
      const unsubscribe = ctx.get("events").subscribe((event) => {
        if (event.type === "terminal") terminal(event.data as TerminalInfo);
        if (event.type === "terminal-output") {
          const data = event.data as { id: string; text: string };
          if (parsers.get(data.id)?.sessionId === event.sessionId) {
            output(data.id, data.text);
          }
        }
      });
      for (const info of ctx.get("terminal").list()) terminal(info);
      ctx.provide("devServers", {
        snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      });
      const unregister = ctx.get("rpc").register("dev-servers.list", snapshot);
      ctx.effect(() => () => {
        unsubscribe();
        unregister();
        parsers.clear();
        servers.clear();
        publish();
        listeners.clear();
      });
    },
  },
});
