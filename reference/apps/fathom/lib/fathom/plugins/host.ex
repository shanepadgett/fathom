defmodule Fathom.Plugins.Host do
  @moduledoc """
  What the host ships, in the terms the plugin builder needs:

    * `pins/0` - Hex packages the host runs, at the versions it runs. Local
      plugins resolve around them and never get a second copy.
    * `stubs/0` - Fathom's own applications (the harness, its libraries, and
      bundled plugins), which are not on Hex. The builder stands in for them.
    * `apps/0` - every application already in the node. The builder never
      compiles these.
  """

  @lock Path.expand("../../../mix.lock", __DIR__)
  @external_resource @lock

  @hex (for {app, lock} <- Mix.Dep.Lock.read(@lock), elem(lock, 0) == :hex do
          {app, elem(lock, 1), elem(lock, 2)}
        end)

  @spec pins() :: [{atom(), atom(), String.t()}]
  def pins, do: for({app, pkg, vsn} <- @hex, version(app) == vsn, do: {app, pkg, vsn})

  @spec stubs() :: [{atom(), String.t()}]
  def stubs do
    own =
      [:fathom] ++
        Application.fetch_env!(:fathom, :libraries) ++ Application.fetch_env!(:fathom, :plugins)

    for app <- own, vsn = version(app), do: {app, vsn}
  end

  # Development builds use the dependency; a release ships a copy in the SDK.
  @dev_icons Path.expand("../../../deps/phosphor_icons/assets/regular", __DIR__)

  @doc "The directory of Phosphor SVGs for `ph-*` classes in plugin CSS."
  @spec icons() :: Path.t()
  def icons do
    shipped = Application.app_dir(:fathom_sdk, "priv/icons/phosphor")
    if File.dir?(shipped), do: shipped, else: @dev_icons
  end

  @spec apps() :: [atom()]
  def apps, do: for({app, _, _} <- Application.loaded_applications(), do: app)

  defp version(app) do
    case Application.spec(app, :vsn) do
      nil -> nil
      vsn -> to_string(vsn)
    end
  end
end
