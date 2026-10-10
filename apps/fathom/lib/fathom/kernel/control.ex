defmodule Fathom.Kernel.Control do
  @moduledoc "The harness implementation of `Fathom.KernelControl`."
  @behaviour Fathom.KernelControl

  @impl true
  defdelegate plugins(), to: Fathom.Kernel

  @impl true
  defdelegate change(id, action), to: Fathom.Kernel

  @impl true
  defdelegate restart_stale(), to: Fathom.Kernel

  @impl true
  defdelegate builds(), to: Fathom.Plugins.Local, as: :status

  @impl true
  defdelegate rebuild(), to: Fathom.Plugins.Local

  @impl true
  defdelegate create(name, ui), to: Fathom.Plugins.Local
end
