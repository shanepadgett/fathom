defmodule Fathom.Plugin.Publisher do
  @moduledoc """
  The last child of a plugin's supervision tree. It registers the plugin's
  services and contributions in the harness registries and holds them for as
  long as it lives. A restart re-registers; a stop or crash releases them.
  """
  use GenServer

  def start_link(plugin), do: GenServer.start_link(__MODULE__, plugin)

  @impl true
  def init(plugin) do
    manifest = Fathom.Plugin.manifest(plugin)

    with :ok <- register_services(manifest, plugin.services()),
         :ok <- register_contributions(manifest, plugin.contributions()) do
      {:ok, manifest}
    else
      {:error, message} -> {:stop, message}
    end
  end

  defp register_services(manifest, services) do
    provided = Enum.map(services, &elem(&1, 0))

    case Enum.find(manifest.provides, &(service?(&1) and &1 not in provided)) do
      nil -> register_each(manifest, services)
      token -> {:error, "lists #{inspect(token)} in :provides but implements no service for it"}
    end
  end

  defp service?(token) do
    Code.ensure_loaded?(token) and function_exported?(token, :__fathom_token__, 0) and
      token.__fathom_token__() == :service
  end

  defp register_each(manifest, services) do
    Enum.reduce_while(services, :ok, fn {token, impl}, :ok ->
      cond do
        token not in manifest.provides ->
          {:halt, {:error, "provides #{inspect(token)} without listing it in :provides"}}

        match?({:error, _}, Registry.register(Fathom.Service.registry(), token, impl)) ->
          {:halt, {:error, "#{inspect(token)} is already provided by another plugin"}}

        true ->
          {:cont, :ok}
      end
    end)
  end

  defp register_contributions(manifest, contributions) do
    allowed = manifest.requires ++ manifest.provides

    result =
      Enum.reduce_while(contributions, :ok, fn {registry, key, value}, :ok ->
        if registry in allowed do
          entry = %Fathom.Registry.Entry{
            registry: registry,
            key: key,
            plugin: manifest.id,
            value: value,
            order: Map.get(value, :order, 100),
            owner: self()
          }

          {:ok, _} = Registry.register(Fathom.Registry.registry(), registry, entry)
          {:cont, :ok}
        else
          {:halt, {:error, "contributes to #{inspect(registry)} without listing it in :requires"}}
        end
      end)

    for registry <- contributions |> Enum.map(&elem(&1, 0)) |> Enum.uniq() do
      Fathom.Registry.notify(registry)
    end

    result
  end
end
