# Elixir harness

Status: the first version is built on `feature/elixir-harness`. Deno's
runtime development ends around October 2027, so Fathom moved to a runtime it
can own long term. [Architecture](../architecture.md) describes what exists;
this file records the decisions behind it and what is still open.

## Decided

| Decision | Reason |
| --- | --- |
| Host language is Elixir on the BEAM. | Stable 1.x language that agents write fluently. OTP provides supervision, cleanup, restarts, and hot code loading. |
| A plugin is an OTP application with a manifest, started and stopped by the kernel. | Plugins look like any Elixir app (`mix new --sup`); OTP owns their trees; `Application.stop/1` releases everything. |
| Services and contributions live in Elixir `Registry` tables, registered by a publisher process at the end of each plugin's tree. | Registrations end with their owner on stop or crash, with no cleanup code. |
| Contracts pass data and pids, never functions, and clients dispatch through `Fathom.Service.call/3`. | Keeps peer-node providers possible without changing any contract. |
| UI is LiveView; each slot contribution is a nested LiveView. | One language end to end; a crashing plugin view never takes down the shell. |
| Shell is Tauri; the host is a child process that stops when the shell's stdin pipe closes. | Mature windows, menus, installers, signing, updater. Rust stays in fixed harness code. |
| Bundled plugins are path dependencies with `runtime: false`, listed in host config. | One build, one code reloader, and the kernel decides when they start. |
| Generators first: `mix phx.new`, `mix new`, `cargo tauri init`, `mix phx.gen.schema`, and Fathom's own `mix fathom.gen.plugin`. | The generated shape is the convention; extending the generator keeps every plugin the same. |
| Third-party plugins may bring their own Hex dependencies. | Plugins are real programs. This makes peer nodes a core design concern. |

## Open

- **Peer nodes.** A second `Fathom.Kernel.Runner` for plugins with their own
  Hex dependencies or NIFs. Decide the transport by prototype: Erlang
  distribution on loopback with a per-launch cookie, or stdio-connected peers
  (`:peer` with `connection: :standard_io`). `Fathom.Service.call/3` then
  dispatches with `:erpc`. A plugin's UI half stays on the host node and may
  depend only on the SDK and host libraries.
- **Installed plugins.** Local plugins in `~/.fathom/plugins`, with Hex
  dependencies, NIFs, and CSS, build and run in the shipped app. Installing
  from Hex and git into the same workspace is next in
  [plugin packages](plugin-packages.md).
- **Signing and updates.** `mise run desktop:build` bundles the `mix release`
  directory (ERTS included, distribution off) as a Tauri resource and runs.
  Signing is ad hoc; notarization and the Tauri updater are not set up.
- **Credential store lock.** The old store held an OS file lock against a
  second Fathom process. Tauri's single-instance plugin is the likely
  replacement.
- **Subprocesses for coding tools.** `erlexec` or `MuonTrap`, decided in the
  tools plugin plan.
- **Slot selection.** The shell shows the first `AppShell` entry and the first
  sidebar entry. Choosing among contributions needs a setting.
