defmodule Fathom.Kernel.Catalog do
  @moduledoc """
  Where bundled plugins come from: the plugin applications listed in the
  host's `:plugins` config, which ships with the app. Local plugins are
  built and loaded by `Fathom.Plugins.Local`, which hands them to the kernel.

  Each plugin application names its manifest module in its app env under
  `:fathom_plugin`; the harness never imports a plugin.
  """
  require Logger

  @spec manifests([atom()]) :: [Fathom.Plugin.Manifest.t()]
  def manifests(apps) do
    apps
    |> Enum.flat_map(&manifest/1)
    |> Enum.uniq_by(& &1.id)
  end

  @doc """
  Reads a stopped plugin's manifest again, after its code changed. A local
  plugin's application spec is loaded again too, from its new `.app` file,
  and its manifest module is taken from there.
  """
  @spec refresh(Fathom.Plugin.Manifest.t(), :bundled | :local) ::
          {:ok, Fathom.Plugin.Manifest.t()} | {:error, String.t()}
  def refresh(manifest, :bundled), do: {:ok, Fathom.Plugin.manifest(manifest.module)}

  def refresh(%{otp_app: app}, :local) do
    Application.unload(app)

    with :ok <- load(app),
         module when module != nil <- Application.get_env(app, :fathom_plugin) do
      {:ok, Fathom.Plugin.manifest(module)}
    else
      nil -> {:error, "#{app} names no plugin manifest"}
      {:error, reason} -> {:error, "Loading #{app} failed: #{inspect(reason)}"}
    end
  rescue
    error -> {:error, "Reading the manifest of #{app} failed: " <> Exception.message(error)}
  end

  defp manifest(app) do
    with :ok <- load(app),
         module when module != nil <- Application.get_env(app, :fathom_plugin),
         true <- Code.ensure_loaded?(module) and function_exported?(module, :__fathom_plugin__, 0) do
      [Fathom.Plugin.manifest(module)]
    else
      _ ->
        Logger.error("#{app} is listed as a plugin but names no Fathom plugin manifest")
        []
    end
  end

  defp load(app) do
    case Application.load(app) do
      :ok -> :ok
      {:error, {:already_loaded, ^app}} -> :ok
      error -> error
    end
  end
end
