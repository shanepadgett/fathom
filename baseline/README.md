# Fathom baseline

A sibling of `app/`, not a replacement. Named services on `ctx`. Tools and
surfaces consume those names. `host.ts` is the default list. Leave a row out to
turn that piece off.

`sdk.ts` is the contract. `definePlugin` only puts injected names on `ctx`.
`compose().use()` only accepts a plugin whose inject is already provided. A
third-party plugin merges its key into `Services` and depends on another by
importing that contract — see `extensions/`.

```text
main.ts     process (env, vite, window)
host.ts     default composition
sdk.ts      Services, definePlugin, compose

workspace
sessions
model
tools
fs                 local disk + path jail
subprocess         Deno.Command
tool-fs            read, write, edit (hashline lives here)
tool-bash          bash on subprocess
tool-script        script on subprocess
logbook            extension: ctx.logbook on fs
tool-logbook       extension: logbook tool (does not inject fs)
agent
surfaces
surface-editor / surface-agent / surface-chat
http
```

Swap `tool-fs` to replace the hashline protocol. Unmount `surface-editor` to
drop the editor. The shell only shows surfaces that registered. Reverse
`logbook` and `tool-logbook` in `host.ts` and `deno check` fails.

Launch: `mise run baseline` → <http://127.0.0.1:4050>

Credentials: `~/.pi/agent/auth.json`
Sessions: `~/.fathom-baseline/data/sessions.db`
Workspace: `$FATHOM_WORKSPACE` or cwd
