# Harness standards

Read this when changing `apps/fathom`, `apps/desktop`, or `packages/fathom_sdk`.

- The harness has no feature behavior. Before adding to it, name the plugin
  whose concrete requirement needs a general contract.
- Keep the kernel's decisions in `Fathom.Kernel.Graph` as pure functions and
  its effects in `Runner`, `Catalog`, and `Desired`. The GenServer only
  orchestrates and serializes.
- Harness services and slots are declared in `Fathom.Host.Plugin` and
  published by the same `Fathom.Plugin.Publisher` plugins use.
- SDK `use` macros stay thin: they define a few functions and call runtime
  code. Large macros create compile-time dependencies that make every plugin
  recompile when the SDK changes.
- SDK components take assigns and slots only; they never read services or
  registries.
- Changing a public SDK function, callback, or message shape changes every
  plugin. Update the generator templates and bundled plugins in the same change.
- The Tauri shell owns the window, menu, and the host process. Feature
  behavior never moves into Rust.
- Phoenix generated `apps/fathom/AGENTS.md`; its Phoenix, LiveView, and
  Elixir rules apply to the host and plugins.
