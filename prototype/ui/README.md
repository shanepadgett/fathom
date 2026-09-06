# UI plugins

The browser uses native ES modules with no build step. `main.js` imports only
the plugins declared by backend `uiPlugins`, in configured order. No UI is
hardcoded into the loader except startup failure and retry. A module exports
`default { id, apiVersion: 1, requires: [], activate(host) }`; activation
returns a cleanup function. `apiVersion` and `requires` are optional;
dependencies name plugin IDs that must activate earlier. Plugins are trusted
application code.

The host supports these contribution points:

- `registerView(id, { title, slot, mount(container, host) })`: adds a view to
  `main` or `rail`. Mount returns a cleanup function.
- `registerRenderer(id, { matches(message), render(message, host) })`:
  contributes a message renderer returning a DOM node. First matching renderer
  wins.
- `registerCommand(id, command)`: registers a callable command in
  `host.commands` for other plugins to consume.
- `state.get()`, `state.subscribe(listener)`, `state.patch(partial)`: shared
  frontend state; subscriptions return cleanup functions.
- `transport.command(name, payload)`, `transport.refresh()`: backend
  interaction.

All registration methods return disposal functions. The host tracks
registrations and subscriptions made through the activation host, removes them
on disposal, and rolls them back if activation fails. Return a cleanup function
for other side effects such as timers or DOM mutations. View unmounting must
dispose subscriptions. `host.activate(plugin)` rejects duplicate contribution
names and does not activate a plugin ID twice. The shell reads the view registry
and responds to registrations and removals.

To replace the whole shell or conversation, substitute its module URL in the
backend UI composition. No loader changes are required.
`examples/session-inspector.js` is a minimal optional view; add
`/ui/examples/session-inspector.js` to bootstrap `uiPlugins` to load it. All
model, tool, and workspace text must use `textContent` or text nodes, never HTML
interpolation.

The prototype deliberately changes the active backend runtime between runs.
Frontend plugin composition is loaded at page startup; reload after changing its
configuration.

The built-in `ui.viewport-scale` plugin owns interface scaling. It registers
`view.zoomIn`, `view.zoomOut`, and `view.resetZoom`, persists the chosen level,
and handles Command/Ctrl with `+`, `-`, and `0`. Native View-menu actions invoke
the same commands through the `fathom:view-command` window event.
