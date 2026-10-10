defmodule Fathom.Plugins.Loader do
  @moduledoc """
  Loads compiled local code into the running node.

  Modules load explicitly: a release boots in embedded mode and never
  searches the code path. A changed module replaces the running one in place,
  as a hot code upgrade does; processes pick up the new code on their next
  call. Protocols that new code implements are consolidated again, because a
  consolidated protocol only dispatches to the implementations it was built
  with.
  """

  @type loaded :: %{ebin: Path.t(), spec: keyword(), modules: %{module() => binary()}}

  @doc """
  Loads `app` from `ebin`. Returns what is now loaded and the modules that
  changed or went away since `previous`.
  """
  @spec load(atom(), Path.t(), loaded() | nil) ::
          {:ok, loaded(), changed :: [module()], removed :: [module()]} | {:error, String.t()}
  def load(app, ebin, previous) do
    with {:ok, spec} <- read_spec(app, ebin) do
      add_path(ebin)
      ensure_loaded(app, spec)

      results = for file <- Path.wildcard(Path.join(ebin, "*.beam")), do: load_module(file)

      case for({:error, module, reason} <- results, do: "#{inspect(module)}: #{inspect(reason)}") do
        [] ->
          modules = Map.new(for {_, module, md5} <- results, do: {module, md5})
          changed = for {:changed, module, _} <- results, do: module
          removed = Map.keys((previous && previous.modules) || %{}) -- Map.keys(modules)
          dropped = impls(removed)
          Enum.each(removed, &unload_module/1)
          reconsolidate(impls(changed), dropped)
          {:ok, %{ebin: ebin, spec: spec, modules: modules}, changed, removed}

        errors ->
          {:error, "Loading #{app} failed: " <> Enum.join(errors, "; ")}
      end
    end
  end

  @doc "Unloads an application that is no longer running, and its code."
  @spec unload(atom(), loaded()) :: :ok
  def unload(app, loaded) do
    Application.unload(app)
    dropped = impls(Map.keys(loaded.modules))
    Enum.each(Map.keys(loaded.modules), &unload_module/1)
    reconsolidate([], dropped)
    :code.del_path(String.to_charlist(loaded.ebin))
    :ok
  end

  defp read_spec(app, ebin) do
    case :file.consult(Path.join(ebin, "#{app}.app")) do
      {:ok, [{:application, ^app, spec}]} -> {:ok, spec}
      other -> {:error, "#{app}.app is missing or unreadable: #{inspect(other)}"}
    end
  end

  defp add_path(ebin) do
    path = String.to_charlist(ebin)
    unless path in :code.get_path(), do: :code.add_patha(path)
  end

  # A new application loads now. One already loaded keeps its spec until the
  # kernel restarts it, so a running plugin never sees its spec change.
  defp ensure_loaded(app, spec) do
    if Application.spec(app) == nil, do: :application.load({:application, app, spec})
  end

  defp load_module(file) do
    module = file |> Path.basename(".beam") |> String.to_atom()
    {:ok, {^module, md5}} = :beam_lib.md5(String.to_charlist(file))

    if :erlang.module_loaded(module) and module.module_info(:md5) == md5 do
      {:same, module, md5}
    else
      :code.purge(module)

      case :code.load_abs(file |> Path.rootname() |> String.to_charlist()) do
        {:module, ^module} -> {:changed, module, md5}
        {:error, reason} -> {:error, module, reason}
      end
    end
  end

  defp unload_module(module) do
    :code.purge(module)
    :code.delete(module)
  end

  # Protocol implementations among `modules`, as {protocol, type}.
  defp impls(modules) do
    for module <- modules,
        Code.ensure_loaded?(module),
        function_exported?(module, :__impl__, 1),
        do: {module.__impl__(:protocol), module.__impl__(:for)}
  end

  defp reconsolidate(added, dropped) do
    added = Enum.group_by(added, &elem(&1, 0), &elem(&1, 1))
    dropped = Enum.group_by(dropped, &elem(&1, 0), &elem(&1, 1))

    for protocol <- Enum.uniq(Map.keys(added) ++ Map.keys(dropped)),
        Code.ensure_loaded?(protocol) and Protocol.consolidated?(protocol) do
      {:consolidated, current} = protocol.__protocol__(:impls)

      types =
        Enum.uniq((current -- Map.get(dropped, protocol, [])) ++ Map.get(added, protocol, []))

      if Enum.sort(types) != Enum.sort(current) do
        # The consolidated module keeps its debug info, so it can be rebuilt.
        {:ok, binary} = Protocol.consolidate(protocol, types)
        file = :code.which(protocol)
        :code.purge(protocol)
        {:module, ^protocol} = :code.load_binary(protocol, file, binary)
      end
    end

    :ok
  end
end
