defmodule Fathom.SDK do
  @moduledoc """
  Everything a Fathom plugin compiles against.

    * `Fathom.Plugin` - define a plugin: what it requires, provides, and starts.
    * `Fathom.Service` - one provider, many consumers, behind a contract module.
    * `Fathom.Registry` - one owner, many contributors, keyed entries.
    * `Fathom.Events` - publish and subscribe across plugins.
    * `Fathom.UI` - LiveView helpers, slots, and controls for plugin UI.
    * `Fathom.HTTP` and `Fathom.SSE` - outbound requests and streams.

  Harness-provided contracts: `Fathom.Environment`, `Fathom.KernelControl`,
  and the application slots under `Fathom.UI`. `Fathom.Storage` is provided
  by the storage plugin.
  """
end
