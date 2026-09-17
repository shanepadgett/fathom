import { createHash } from "node:crypto";
import { extname, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { Type } from "typebox";

import { atomicWrite } from "../../kernel/files.ts";
import { denoExecutable } from "../../kernel/runtime.ts";
import { definePlugin } from "../../sdk/mod.ts";
import { EditorLspService } from "./service.ts";
import { editorPosition, editorText, readEditorText } from "./text.ts";

const checksum = (text: string) => createHash("sha256").update(text).digest("hex");

export default definePlugin({
  id: "fathom:editor",
  apiVersion: 1,
  backend: {
    requires: ["workspace", "rpc", "events", "tools", "storage"],
    provides: ["lsp"],
    async activate(ctx) {
      const workspace = ctx.get("workspace"),
        rpc = ctx.get("rpc"),
        events = ctx.get("events"),
        tools = ctx.get("tools");
      const gateway = new EditorLspService(workspace, events);
      // Register cleanup before any activation work that can throw.
      ctx.effect(() => () => gateway.dispose());
      ctx.provide("lsp", gateway);
      const lsp = gateway;
      ctx.effect(() =>
        lsp.register({
          id: "deno",
          name: "Deno",
          command: denoExecutable(),
          args: ["lsp"],
          languages: {
            ".ts": "typescript",
            ".mts": "typescript",
            ".cts": "typescript",
            ".tsx": "typescriptreact",
            ".mtsx": "typescriptreact",
            ".ctsx": "typescriptreact",
            ".js": "javascript",
            ".mjs": "javascript",
            ".cjs": "javascript",
            ".jsx": "javascriptreact",
            ".mjsx": "javascriptreact",
            ".cjsx": "javascriptreact",
          },
          initializationOptions: { enable: true, lint: true },
          priority: 0,
        }),
      );
      const storage = ctx.get("storage");
      const buffers = new Map<string, { text: string; version: string }>();
      const unresolved: {
        path: string;
        text: string;
        version: string;
        error: string;
      }[] = [];
      for (const draft of storage.setting<{ path: string; text: string; version: string }[]>(
        "editor.drafts",
        [],
      )) {
        try {
          const path = await workspace.resolve(draft.path, true);
          buffers.set(path, {
            text: editorText(draft.text),
            version: draft.version,
          });
          await lsp.update(path, editorText(draft.text));
        } catch (error) {
          unresolved.push({ ...draft, error: String(error) });
        }
      }
      const persist = () =>
        storage.setSetting("editor.drafts", [
          ...unresolved,
          ...[...buffers].map(([path, draft]) => ({
            path: relative(workspace.root, path),
            ...draft,
          })),
        ]);
      const read = async (value: string) => {
        const path = await workspace.resolve(value);
        const text = await readEditorText(path);
        await lsp.update(path, buffers.get(path)?.text ?? text);
        return {
          path: relative(workspace.root, path),
          uri: pathToFileURL(path).href,
          text,
          version: checksum(text),
          extension: extname(path),
          diagnostics: (await lsp.getDiagnostics([path]))[0].diagnostics,
        };
      };
      const disposers = [
        rpc.register("files.list", async (params) => {
          const root = await workspace.resolve(String(params.path ?? "."));
          const entries = [];
          for await (const entry of Deno.readDir(root)) {
            if ([".git", "node_modules", ".DS_Store"].includes(entry.name)) {
              continue;
            }
            entries.push({
              name: entry.name,
              path: relative(workspace.root, `${root}/${entry.name}`),
              directory: entry.isDirectory,
            });
            if (entries.length >= 3000) break;
          }
          return entries.sort(
            (a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name),
          );
        }),
        rpc.register("file.read", (params) => read(String(params.path))),
        rpc.register("file.recover", async (params) => {
          const source = String(params.path);
          const unresolvedIndex = unresolved.findIndex((draft) => draft.path === source);
          const buffer = [...buffers].find(([path]) => relative(workspace.root, path) === source);
          const draft = unresolvedIndex >= 0 ? unresolved[unresolvedIndex] : buffer?.[1];
          if (!draft) {
            throw new Error("This recovered draft is no longer available.");
          }
          const destination = String(params.destination ?? "").trim();
          if (!destination) {
            throw new Error("Enter a workspace path for the recovered file.");
          }
          const path = await workspace.resolve(destination, true);
          const recoveredText = editorText(draft.text);
          // Exclusive creation keeps recovery from replacing an existing file.
          const file = await Deno.open(path, {
            write: true,
            createNew: true,
            mode: 0o600,
          });
          try {
            const bytes = new TextEncoder().encode(recoveredText);
            let offset = 0;
            while (offset < bytes.length) {
              offset += await file.write(bytes.subarray(offset));
            }
            await file.sync();
          } finally {
            file.close();
          }
          const document = await read(path);
          if (unresolvedIndex >= 0) unresolved.splice(unresolvedIndex, 1);
          else if (buffer) buffers.delete(buffer[0]);
          persist();
          events.publish({
            type: "file",
            data: { path: document.path, changed: true },
          });
          return document;
        }),
        rpc.register("file.drafts", async () => {
          const recovered: {
            document?: Awaited<ReturnType<typeof read>>;
            path?: string;
            text: string;
            error?: string;
          }[] = [...unresolved];
          for (const [path, draft] of buffers) {
            try {
              recovered.push({
                document: { ...(await read(path)), version: draft.version },
                text: draft.text,
              });
            } catch (error) {
              recovered.push({
                path: relative(workspace.root, path),
                text: draft.text,
                error: String(error),
              });
            }
          }
          return recovered;
        }),
        rpc.register("file.change", async (params) => {
          const path = await workspace.resolve(String(params.path));
          const text = editorText(params.text);
          const diskText = await readEditorText(path);
          if (text === diskText) buffers.delete(path);
          else {
            buffers.set(path, {
              text,
              version:
                typeof params.version === "string"
                  ? params.version
                  : (buffers.get(path)?.version ?? checksum(diskText)),
            });
          }
          persist();
          await lsp.update(path, text);
          return {};
        }),
        rpc.register("file.discard", async (params) => {
          const path = await workspace.resolve(String(params.path));
          buffers.delete(path);
          persist();
          return await read(path);
        }),
        rpc.register("file.save", async (params) => {
          const path = await workspace.resolve(String(params.path), true);
          const text = await readEditorText(path);
          if (checksum(text) !== params.version) {
            throw new Error("File changed on disk. Reload or copy your edits before saving.");
          }
          const next = editorText(params.text);
          await atomicWrite(path, next, ((await Deno.stat(path)).mode ?? 0o644) & 0o777);
          buffers.delete(path);
          persist();
          await lsp.update(path, next);
          events.publish({
            type: "file",
            data: { path: String(params.path), changed: true },
          });
          return await read(path);
        }),
        rpc.register("lsp.completion", async (params) => {
          if (typeof params.path !== "string") {
            throw new Error("Invalid completion path");
          }
          const text = editorText(params.text);
          return await lsp.completion(params.path, text, editorPosition(params.position, text));
        }),
        rpc.register("lsp.diagnostics", async (params) => {
          if (typeof params.path !== "string") {
            throw new Error("Invalid diagnostic path");
          }
          const file = await read(params.path);
          return file.diagnostics;
        }),
        rpc.register("lsp.status", (params) => {
          if (params.path !== undefined && typeof params.path !== "string") {
            throw new Error("Invalid language server path");
          }
          return lsp.status(params.path);
        }),
        rpc.register("lsp.servers", () => lsp.servers()),
        rpc.register("lsp.restart", (params) => {
          if (typeof params.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/.test(params.id)) {
            throw new Error("Invalid language server id");
          }
          return lsp.restart(params.id);
        }),
        tools.register({
          name: "lsp_diagnostics",
          description: "Inspect live editor language diagnostics, including unsaved buffers.",
          readOnly: true,
          deferred: true,
          parameters: Type.Object({ path: Type.String() }),
          async execute(args) {
            const file = await read(String(args.path));
            return JSON.stringify({
              path: file.path,
              diagnostics: file.diagnostics,
              server: await lsp.status(file.path),
            });
          },
        }),
      ];
      ctx.cordis.on("tool:before", async (input) => {
        if (["write", "edit"].includes(input.name)) {
          const path = await workspace.resolve(String(input.args.path), true);
          if (buffers.has(path)) {
            return {
              action: "block",
              reason:
                "This file has unsaved editor changes. Ask the user to save or discard them before editing.",
            };
          }
        }
      });
      ctx.cordis.on("tool:after", async (input) => {
        if (["read", "write", "edit"].includes(input.name) && !input.isError) {
          // Agent file tools may handle larger/binary files than the editor.
          // Intelligence must not turn an already successful file operation into
          // a tool error. The shared gateway still enforces its own limits.
          try {
            await read(String(input.args.path));
          } catch {
            // No LSP for files outside the editor's text/size/path boundary.
          }
        }
      });
      ctx.effect(() => async () => {
        for (const dispose of disposers) dispose();
      });
    },
  },
});
