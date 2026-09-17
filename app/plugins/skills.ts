import { dirname, join, relative } from "node:path";

import { load } from "npm:js-yaml@4.1.0";
import { Type } from "typebox";

import { definePlugin } from "../sdk/mod.ts";
import { runProcess } from "./tools/process.ts";

interface Skill {
  name: string;
  description: string;
  path: string;
  body: string;
  userInvocable: boolean;
  agentInvocable: boolean;
  requiresTools: string[];
}

async function exists(path: string) {
  try {
    return await Deno.stat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

function parse(text: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  return {
    metadata: (match ? load(match[1]) : {}) as Record<string, unknown>,
    body: match?.[2] ?? text,
  };
}

export function skillsPlugin(home: string) {
  return definePlugin({
    id: "fathom:skills",
    apiVersion: 1,
    backend: {
      requires: ["workspace", "storage", "tools", "context", "rpc"],
      async activate(ctx) {
        const workspace = ctx.get("workspace"),
          storage = ctx.get("storage"),
          tools = ctx.get("tools"),
          context = ctx.get("context"),
          rpc = ctx.get("rpc");
        const roots = [
          join(home, "skills"),
          ...(workspace.trusted()
            ? [join(workspace.root, ".fathom/skills"), join(workspace.root, ".agents/skills")]
            : []),
        ];
        const skills = new Map<string, Skill>();
        const disposers: (() => void)[] = [];
        for (const root of roots) {
          if (!(await exists(root))) continue;
          for await (const entry of Deno.readDir(root)) {
            if (!entry.isDirectory) continue;
            const path = join(root, entry.name, "SKILL.md");
            if (!(await exists(path))) continue;
            const { metadata, body } = parse(await Deno.readTextFile(path));
            const name = String(metadata.name ?? entry.name);
            if (!/^[a-zA-Z0-9_-]+$/.test(name)) continue;
            skills.set(name, {
              name,
              description: String(metadata.description ?? name),
              path,
              body,
              userInvocable: metadata.user_invocable !== false,
              agentInvocable: metadata.agent_invocable !== false,
              requiresTools: Array.isArray(metadata.requires_tools)
                ? metadata.requires_tools.map(String)
                : [],
            });
          }
        }
        for (const skill of skills.values()) {
          if (skill.agentInvocable) {
            disposers.push(
              tools.register({
                name: `skill_${skill.name.replaceAll("-", "_")}`,
                description: skill.description,
                readOnly: true,
                deferred: true,
                tags: ["skill", skill.name],
                parameters: Type.Object({}),
                async execute(_args, input) {
                  const available = new Set(
                    tools.list(input.sessionId, true).map((tool) => tool.name),
                  );
                  if (skill.requiresTools.some((tool) => !available.has(tool))) {
                    throw new Error("This skill requires tools disabled by the session policy");
                  }
                  return `Skill ${skill.name}\nSource: ${skill.path}\nResolve references and scripts relative to ${dirname(
                    skill.path,
                  )}.\n\n${skill.body}`;
                },
              }),
            );
          }
        }
        disposers.push(
          rpc.register("skills.list", () =>
            [...skills.values()].map(({ body: _body, ...skill }) => skill),
          ),
        );
        disposers.push(
          context.registerPromptSection(
            "skills",
            [...skills.values()]
              .filter((skill) => skill.agentInvocable)
              .map((skill) => `${skill.name}: ${skill.description} (discover with search_tools)`)
              .join("\n"),
          ),
        );
        disposers.push(
          context.registerProjector("directory-rules", (data) => ({
            role: "user",
            content: `Instructions for the current directory:\n${String(data)}`,
            timestamp: 0,
          })),
        );
        const injected = new Map<string, Set<string>>();
        ctx.cordis.on("tool:before", async (input) => {
          if (!workspace.trusted() || !["read", "write", "edit"].includes(input.name)) return;
          const path = await workspace.resolve(String(input.args.path), true);
          const segments = relative(workspace.root, dirname(path)).split("/").filter(Boolean);
          const seen = injected.get(input.sessionId) ?? new Set<string>();
          let current = workspace.root;
          for (const segment of segments) {
            current = join(current, segment);
            const rules = join(current, "AGENTS.md");
            if (seen.has(rules) || !(await exists(rules))) continue;
            const text = await Deno.readTextFile(rules);
            if (text.length < 64_000) {
              storage.append(input.sessionId, {
                kind: "custom",
                status: "completed",
                custom: { type: "directory-rules", data: `${rules}\n${text}` },
              });
            }
            seen.add(rules);
          }
          injected.set(input.sessionId, seen);
        });
        ctx.cordis.on("run:admit", async (input) => {
          const match = /^\/([\w-]+)(?:\s+([\s\S]*))?$/.exec(input.text);
          if (!match) return;
          const [, name, args = ""] = match;
          const skill = skills.get(name);
          if (skill?.userInvocable) {
            input.text = `Use the ${name} skill.\n${skill.body}\n\nUser request: ${args}`;
            return;
          }
          const promptRoots = [
            join(home, "prompts"),
            ...(workspace.trusted() ? [join(workspace.root, ".fathom/prompts")] : []),
          ];
          let body: string | undefined;
          for (const root of promptRoots) {
            if (await exists(join(root, `${name}.md`))) {
              body = parse(await Deno.readTextFile(join(root, `${name}.md`))).body;
            }
          }
          if (body === undefined) return;
          const blocks = [...body.matchAll(/```!bash\s*\n([\s\S]*?)```/g)];
          for (const block of blocks) {
            const output = await runProcess({
              command: "/bin/bash",
              args: ["-c", block[1]],
              cwd: workspace.root,
              signal: input.signal,
              timeoutMs: 10_000,
              logPath: join(
                workspace.dataDir,
                "scratch",
                input.sessionId,
                `prompt-${crypto.randomUUID()}.log`,
              ),
              report() {},
            });
            body = body.replace(block[0], `\nCommand output:\n${output}\n`);
          }
          input.text = `${body}\n\n${args}`;
        });
        ctx.effect(() => () => {
          for (const dispose of disposers) dispose();
        });
      },
    },
  });
}
